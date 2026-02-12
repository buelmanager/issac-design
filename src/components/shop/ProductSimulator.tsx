import { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { marchingSquaresTrace } from '../simulator/lib/marchingSquares';
import { processContoursToShapes } from '../simulator/lib/contourUtils';

/**
 * ProductSimulator - Simplified 3D signage preview for product pages
 * Features material presets and streamlined UI
 */

// ─── Types ───

interface ShapeResult {
  shapes: THREE.Shape[];
  imageWidth: number;
  imageHeight: number;
  maskWidth: number;
  maskHeight: number;
  scale: number;
}

type MaterialPreset = 'metal-channel' | 'neon-sign' | 'acrylic';

interface MaterialConfig {
  label: string;
  icon: string;
  color: string;
  metalness: number;
  roughness: number;
  depth: number;
  ledIntensity: number;
  ledColor: string;
  backboardColor: string;
  lightIntensity: number;
}

// ─── Material Presets ───

const MATERIAL_PRESETS: Record<MaterialPreset, MaterialConfig> = {
  'metal-channel': {
    label: '금속 채널',
    icon: '🔩',
    color: '#c0c0c0',
    metalness: 0.9,
    roughness: 0.2,
    depth: 2.5,
    ledIntensity: 2.5,
    ledColor: '#ffffff',
    backboardColor: '#2a2a2a',
    lightIntensity: 2.0,
  },
  'neon-sign': {
    label: '네온 사인',
    icon: '✨',
    color: '#ff3366',
    metalness: 0.3,
    roughness: 0.7,
    depth: 1.0,
    ledIntensity: 4.0,
    ledColor: '#ff0080',
    backboardColor: '#1a1a1a',
    lightIntensity: 1.5,
  },
  'acrylic': {
    label: '아크릴',
    icon: '💎',
    color: '#ffffff',
    metalness: 0.1,
    roughness: 0.15,
    depth: 1.5,
    ledIntensity: 3.0,
    ledColor: '#4CAF50',
    backboardColor: '#222222',
    lightIntensity: 2.5,
  },
};

// ─── Image Processing ───

function extractAlphaMask(imageData: ImageData, threshold: number = 128): boolean[][] {
  const { width, height, data } = imageData;
  const mask: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      row.push(alpha >= threshold);
    }
    mask.push(row);
  }
  return mask;
}

function downsampleMask(mask: boolean[][], factor: number): boolean[][] {
  const h = mask.length;
  const w = mask[0].length;
  const newH = Math.ceil(h / factor);
  const newW = Math.ceil(w / factor);
  const result: boolean[][] = [];
  for (let y = 0; y < newH; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < newW; x++) {
      let opaqueCount = 0;
      let totalCount = 0;
      for (let dy = 0; dy < factor && y * factor + dy < h; dy++) {
        for (let dx = 0; dx < factor && x * factor + dx < w; dx++) {
          if (mask[y * factor + dy][x * factor + dx]) opaqueCount++;
          totalCount++;
        }
      }
      row.push(opaqueCount > totalCount / 2);
    }
    result.push(row);
  }
  return result;
}

function pngToShapes(imageData: ImageData, scale: number = 0.02): ShapeResult {
  const rawMask = extractAlphaMask(imageData, 128);
  const mask = downsampleMask(rawMask, 2);
  const h = mask.length;
  const w = mask[0].length;

  const contours = marchingSquaresTrace(mask);
  const shapes = processContoursToShapes(contours, w, h, scale, 1.5);

  return {
    shapes,
    imageWidth: imageData.width,
    imageHeight: imageData.height,
    maskWidth: w,
    maskHeight: h,
    scale
  };
}

// ─── 3D Components ───

interface ExtrudedMeshProps {
  shapes: THREE.Shape[];
  config: MaterialConfig;
  texture: THREE.Texture | null;
}

function ExtrudedMesh({ shapes, config, texture }: ExtrudedMeshProps) {
  const extrudeSettings = {
    depth: config.depth,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.03,
    bevelSegments: 3,
    steps: 1,
  };

  const geometry = new THREE.ExtrudeGeometry(shapes, extrudeSettings);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const box = geometry.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const targetSize = 4;
  const autoScale = maxDim > 0 ? targetSize / maxDim : 1;

  const center = new THREE.Vector3();
  box.getCenter(center);

  // Backboard
  const boardWidth = size.x * autoScale + 1.0;
  const boardHeight = size.y * autoScale + 0.8;
  const standoffDistance = 0.3;

  return (
    <group>
      {/* Backboard */}
      <mesh
        receiveShadow
        position={[0, 0, -(standoffDistance + config.depth * autoScale + 0.05)]}
      >
        <boxGeometry args={[boardWidth, boardHeight, 0.2]} />
        <meshStandardMaterial
          color={config.backboardColor}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>

      {/* LED Glow */}
      {config.ledIntensity > 0 && (
        <pointLight
          color={config.ledColor}
          intensity={config.ledIntensity}
          distance={4}
          decay={2}
          position={[0, 0, -standoffDistance * 0.6]}
        />
      )}

      {/* Main Mesh */}
      <mesh
        castShadow
        receiveShadow
        geometry={geometry}
        scale={[autoScale, autoScale, autoScale]}
        position={[-center.x * autoScale, -center.y * autoScale, -center.z * autoScale]}
      >
        <meshStandardMaterial
          color={config.color}
          metalness={config.metalness}
          roughness={config.roughness}
          map={texture}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}

function Scene({ shapes, config, texture }: { shapes: THREE.Shape[]; config: MaterialConfig; texture: THREE.Texture | null }) {
  if (shapes.length === 0) return null;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 5, 5]}
        intensity={config.lightIntensity}
        castShadow
      />
      <directionalLight
        position={[-3, 3, -3]}
        intensity={config.lightIntensity * 0.4}
      />

      <ExtrudedMesh shapes={shapes} config={config} texture={texture} />

      <ContactShadows
        position={[0, -3, 0]}
        opacity={0.4}
        scale={12}
        blur={2.5}
        far={5}
      />
      <Environment preset="city" />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={15}
      />
    </>
  );
}

// ─── Main Component ───

export default function ProductSimulator() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [shapes, setShapes] = useState<THREE.Shape[]>([]);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<MaterialPreset>('metal-channel');

  const config = MATERIAL_PRESETS[preset];

  const processImage = useCallback((url: string) => {
    setLoading(true);
    setError(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        const result = pngToShapes(imageData, 0.02);

        if (result.shapes.length === 0) {
          setError('투명 배경이 있는 PNG 파일을 업로드해주세요.');
          setShapes([]);
        } else {
          setShapes(result.shapes);

          // Load texture
          const tex = new THREE.TextureLoader().load(url, (loadedTex) => {
            loadedTex.colorSpace = THREE.SRGBColorSpace;
            loadedTex.flipY = false;
            loadedTex.wrapS = THREE.ClampToEdgeWrapping;
            loadedTex.wrapT = THREE.ClampToEdgeWrapping;
            loadedTex.needsUpdate = true;
          });
          setTexture(tex);
          setError(null);
        }
      } catch (e) {
        setError(`처리 오류: ${(e as Error).message}`);
      } finally {
        setLoading(false);
      }
    };

    img.onerror = () => {
      setError('이미지 로드 실패');
      setLoading(false);
    };

    img.src = url;
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다');
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
  }, []);

  useEffect(() => {
    if (imageUrl) {
      processImage(imageUrl);
    }
  }, [imageUrl, processImage]);

  // Load default placeholder
  useEffect(() => {
    setImageUrl('/images/test.png');
  }, []);

  return (
    <div className="product-simulator">
      <div className="product-simulator__container">
        {/* Header */}
        <div className="product-simulator__header">
          <h3 className="product-simulator__title">3D 시뮬레이터로 미리보기</h3>
          <p className="product-simulator__description">
            로고를 업로드하고 실제 간판 모습을 미리 확인해보세요
          </p>
        </div>

        <div className="product-simulator__content">
          {/* Canvas */}
          <div className="product-simulator__canvas">
            <Canvas
              camera={{ position: [0, 0, 8], fov: 50 }}
              style={{ background: '#1a1a2e', borderRadius: '12px' }}
            >
              <Scene shapes={shapes} config={config} texture={texture} />
            </Canvas>

            {loading && (
              <div className="product-simulator__loading">
                <div className="spinner"></div>
                <span>처리 중...</span>
              </div>
            )}

            {error && !loading && (
              <div className="product-simulator__error">{error}</div>
            )}
          </div>

          {/* Controls */}
          <div className="product-simulator__controls">
            {/* File Upload */}
            <div className="simulator-control">
              <label className="simulator-control__label">로고 업로드</label>
              <label className="simulator-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>PNG / JPG 업로드</span>
              </label>
              <p className="simulator-control__hint">
                투명 배경 PNG 권장
              </p>
            </div>

            {/* Material Presets */}
            <div className="simulator-control">
              <label className="simulator-control__label">소재 선택</label>
              <div className="simulator-presets">
                {(Object.keys(MATERIAL_PRESETS) as MaterialPreset[]).map((key) => {
                  const mat = MATERIAL_PRESETS[key];
                  return (
                    <button
                      key={key}
                      className={`simulator-preset ${preset === key ? 'active' : ''}`}
                      onClick={() => setPreset(key)}
                    >
                      <span className="simulator-preset__icon">{mat.icon}</span>
                      <span className="simulator-preset__label">{mat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Info */}
            <div className="simulator-info">
              <div className="simulator-info__item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>마우스로 회전 및 확대/축소 가능</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
