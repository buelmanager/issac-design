import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { marchingSquaresTrace } from './lib/marchingSquares';
import { processContoursToShapes } from './lib/contourUtils';

// ─── Alpha mask extraction ───

function extractAlphaMask(
  imageData: ImageData,
  threshold: number = 128,
): boolean[][] {
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

function downsampleMask(
  mask: boolean[][],
  factor: number,
): boolean[][] {
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

// ─── Convert PNG to THREE.Shape using Marching Squares ───

interface ShapeResult {
  shapes: THREE.Shape[];
  imageWidth: number;
  imageHeight: number;
  maskWidth: number;
  maskHeight: number;
  scale: number;
}

function pngToShapes(
  imageData: ImageData,
  scale: number = 0.02,
  downsampleFactor: number = 2,
  simplifyEpsilon: number = 1.5,
): ShapeResult {
  const rawMask = extractAlphaMask(imageData, 128);
  const mask = downsampleFactor > 1 ? downsampleMask(rawMask, downsampleFactor) : rawMask;
  const h = mask.length;
  const w = mask[0].length;

  const contours = marchingSquaresTrace(mask);
  const shapes = processContoursToShapes(contours, w, h, scale, simplifyEpsilon);
  return { shapes, imageWidth: imageData.width, imageHeight: imageData.height, maskWidth: w, maskHeight: h, scale };
}

// ─── Texture quality presets ───
type TextureQuality = 'low' | 'mid' | 'high';
const TEXTURE_PRESETS: Record<TextureQuality, { downsample: number; simplify: number; label: string }> = {
  low:  { downsample: 4, simplify: 3,   label: '하' },
  mid:  { downsample: 2, simplify: 1.5, label: '중' },
  high: { downsample: 1, simplify: 0.8, label: '상' },
};

// ─── Material presets ───
type MaterialPreset = 'metal-channel' | 'neon-sign' | 'acrylic' | 'custom';
interface MaterialPresetConfig {
  label: string;
  icon: string;
  color: string;
  depth: number;
  backboardColor: string;
  ledColor: string;
  ledIntensity: number;
  ledSpacing: number;
  standoffDistance: number;
  ledSpread: number;
  boardPaddingX: number;
  boardPaddingY: number;
  boardDepth: number;
  lightColor: string;
  lightIntensity: number;
}

const MATERIAL_PRESETS: Record<Exclude<MaterialPreset, 'custom'>, MaterialPresetConfig> = {
  'metal-channel': {
    label: '금속 채널',
    icon: '🔩',
    color: '#c0c0c0',
    depth: 2.5,
    backboardColor: '#2a2a2a',
    ledColor: '#ffffff',
    ledIntensity: 2.5,
    ledSpacing: 0.8,
    standoffDistance: 0.3,
    ledSpread: 0.15,
    boardPaddingX: 0.6,
    boardPaddingY: 0.5,
    boardDepth: 0.2,
    lightColor: '#ffffff',
    lightIntensity: 2.0,
  },
  'neon-sign': {
    label: '네온 사인',
    icon: '✨',
    color: '#ff3366',
    depth: 1.0,
    backboardColor: '#1a1a1a',
    ledColor: '#ff0080',
    ledIntensity: 4.0,
    ledSpacing: 0.5,
    standoffDistance: 0.2,
    ledSpread: 0.25,
    boardPaddingX: 0.4,
    boardPaddingY: 0.4,
    boardDepth: 0.15,
    lightColor: '#ffccdd',
    lightIntensity: 1.5,
  },
  'acrylic': {
    label: '아크릴',
    icon: '💎',
    color: '#ffffff',
    depth: 1.5,
    backboardColor: '#222222',
    ledColor: '#4CAF50',
    ledIntensity: 3.0,
    ledSpacing: 0.7,
    standoffDistance: 0.25,
    ledSpread: 0.18,
    boardPaddingX: 0.5,
    boardPaddingY: 0.45,
    boardDepth: 0.18,
    lightColor: '#ffffff',
    lightIntensity: 2.5,
  },
};

// ─── 3D Extruded Mesh Component with Backlit LED ───

interface ExtrudedMeshProps {
  shapes: THREE.Shape[];
  shapeResult: ShapeResult | null;
  depth: number;
  color: string;
  bevelEnabled: boolean;
  bevelThickness: number;
  bevelSize: number;
  metalness: number;
  roughness: number;
  wireframe: boolean;
  texture: THREE.Texture | null;
  showBackboard: boolean;
  backboardColor: string;
  ledColor: string;
  ledIntensity: number;
  standoffDistance: number;
  ledSpread: number;
  boardPaddingX: number;
  boardPaddingY: number;
  boardDepth: number;
  lightColor: string;
  lightIntensity: number;
  ledSpacing: number;
}

function ExtrudedMesh({
  shapes, shapeResult, depth, color, bevelEnabled, bevelThickness, bevelSize,
  metalness, roughness, wireframe, texture, showBackboard, backboardColor,
  ledColor, ledIntensity, standoffDistance, ledSpread,
  boardPaddingX, boardPaddingY, boardDepth, lightColor, lightIntensity, ledSpacing,
}: ExtrudedMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (glowRef.current && glowRef.current.material instanceof THREE.ShaderMaterial) {
      glowRef.current.material.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const extrudeSettings = useMemo(
    () => ({ depth, bevelEnabled, bevelThickness, bevelSize, bevelSegments: 3, steps: 1 }),
    [depth, bevelEnabled, bevelThickness, bevelSize],
  );

  const computed = useMemo(() => {
    if (shapes.length === 0) return null;

    const geo = new THREE.ExtrudeGeometry(shapes, extrudeSettings);
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 4;
    const s = maxDim > 0 ? targetSize / maxDim : 1;
    const center = new THREE.Vector3();
    box.getCenter(center);

    if (shapeResult) {
      const uvAttr = geo.getAttribute('uv');
      const posAttr = geo.getAttribute('position');
      const geoScale = shapeResult.scale;
      const mw = shapeResult.maskWidth;
      const mh = shapeResult.maskHeight;
      if (uvAttr && posAttr) {
        for (let i = 0; i < uvAttr.count; i++) {
          const gx = posAttr.getX(i);
          const gy = posAttr.getY(i);
          const maskX = gx / geoScale + mw / 2;
          const maskY = -(gy / geoScale) + mh / 2;
          uvAttr.setXY(i, maskX / mw, maskY / mh);
        }
        uvAttr.needsUpdate = true;
      }
    }

    const glowGeo = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.01, bevelEnabled: true, bevelThickness: 0,
      bevelSize: ledSpread / s, bevelSegments: 8, steps: 1,
    });
    glowGeo.computeBoundingBox();

    return { geometry: geo, glowGeometry: glowGeo, scale: s, offset: center, size };
  }, [shapes, shapeResult, extrudeSettings, ledSpread]);

  const glowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(ledColor) },
        uIntensity: { value: ledIntensity },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal; varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal); vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor; uniform float uIntensity; uniform float uTime;
        varying vec3 vNormal; varying vec3 vPosition;
        void main() {
          float facingAway = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
          float glow = pow(facingAway, 1.5) * uIntensity;
          glow *= 0.9 + 0.1 * sin(uTime * 1.5);
          gl_FragColor = vec4(uColor * glow, glow * 0.8);
        }
      `,
    });
  }, [ledColor, ledIntensity]);

  useEffect(() => {
    glowMaterial.uniforms.uColor.value.set(ledColor);
    glowMaterial.uniforms.uIntensity.value = ledIntensity;
  }, [ledColor, ledIntensity, glowMaterial]);

  if (!computed) return null;

  const { geometry, glowGeometry, scale: autoScale, offset, size } = computed;
  const boardWidth = size.x * autoScale + boardPaddingX * 2;
  const boardHeight = size.y * autoScale + boardPaddingY * 2;

  // Grid-based LED placement: fill board with LEDs at even spacing
  const pointLights = useMemo(() => {
    const lights: { position: [number, number, number]; intensity: number }[] = [];
    if (ledSpacing <= 0) return lights;

    // Calculate how many LEDs fit in each direction
    const usableWidth = boardWidth * 0.8;
    const usableHeight = boardHeight * 0.8;
    const cols = Math.max(1, Math.round(usableWidth / ledSpacing));
    const rows = Math.max(1, Math.round(usableHeight / ledSpacing));

    // Actual spacing to distribute evenly
    const dx = cols > 1 ? usableWidth / (cols - 1) : 0;
    const dy = rows > 1 ? usableHeight / (rows - 1) : 0;

    const zPos = -(standoffDistance * 0.6);
    const totalLeds = cols * rows;
    // Scale intensity per LED so total brightness stays reasonable
    const perLedIntensity = ledIntensity * (3 / Math.sqrt(totalLeds));

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = cols > 1 ? -usableWidth / 2 + col * dx : 0;
        const y = rows > 1 ? -usableHeight / 2 + row * dy : 0;
        lights.push({
          position: [x, y, zPos],
          intensity: perLedIntensity,
        });
      }
    }
    return lights;
  }, [boardWidth, boardHeight, ledSpacing, standoffDistance, ledIntensity]);

  return (
    <group ref={groupRef}>
      {showBackboard && (
        <mesh receiveShadow position={[0, 0, -(standoffDistance + depth * autoScale + 0.05)]}>
          <boxGeometry args={[boardWidth, boardHeight, boardDepth]} />
          <meshStandardMaterial color={backboardColor} metalness={0.1} roughness={0.8} />
        </mesh>
      )}

      {showBackboard && ledIntensity > 0 && (
        <>
          <mesh ref={glowRef} geometry={glowGeometry} material={glowMaterial}
            scale={[autoScale, autoScale, autoScale]}
            position={[-offset.x * autoScale, -offset.y * autoScale, -(standoffDistance * 0.5) - offset.z * autoScale]}
          />
          {pointLights.map((light, idx) => (
            <pointLight key={idx} color={ledColor} intensity={light.intensity}
              distance={standoffDistance * 4 + 2} decay={2} position={light.position}
            />
          ))}
        </>
      )}

      <mesh castShadow receiveShadow geometry={geometry}
        scale={[autoScale, autoScale, autoScale]}
        position={[-offset.x * autoScale, -offset.y * autoScale, -offset.z * autoScale]}
      >
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness}
          wireframe={wireframe} map={texture} side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}

// ─── Scene Component ───

interface SceneProps {
  shapes: THREE.Shape[];
  shapeResult: ShapeResult | null;
  depth: number;
  color: string;
  bevelEnabled: boolean;
  bevelThickness: number;
  bevelSize: number;
  metalness: number;
  roughness: number;
  wireframe: boolean;
  texture: THREE.Texture | null;
  bgColor: string;
  showBackboard: boolean;
  backboardColor: string;
  ledColor: string;
  ledIntensity: number;
  standoffDistance: number;
  ledSpread: number;
  boardPaddingX: number;
  boardPaddingY: number;
  boardDepth: number;
  lightColor: string;
  lightIntensity: number;
  ledSpacing: number;
}

function Scene(props: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.4} color={props.lightColor} />
      <directionalLight position={[5, 5, 5]} intensity={props.lightIntensity} color={props.lightColor} castShadow />
      <directionalLight position={[-3, 3, -3]} intensity={props.lightIntensity * 0.4} color={props.lightColor} />
      <directionalLight position={[0, -2, 3]} intensity={props.lightIntensity * 0.2} color={props.lightColor} />

      <ExtrudedMesh
        shapes={props.shapes} shapeResult={props.shapeResult}
        depth={props.depth} color={props.color}
        bevelEnabled={props.bevelEnabled} bevelThickness={props.bevelThickness} bevelSize={props.bevelSize}
        metalness={props.metalness} roughness={props.roughness}
        wireframe={props.wireframe} texture={props.texture}
        showBackboard={props.showBackboard} backboardColor={props.backboardColor}
        ledColor={props.ledColor} ledIntensity={props.ledIntensity}
        standoffDistance={props.standoffDistance} ledSpread={props.ledSpread}
        boardPaddingX={props.boardPaddingX} boardPaddingY={props.boardPaddingY} boardDepth={props.boardDepth}
        lightColor={props.lightColor} lightIntensity={props.lightIntensity} ledSpacing={props.ledSpacing}
      />

      <ContactShadows position={[0, -3, 0]} opacity={0.4} scale={12} blur={2.5} far={5} />
      <Environment preset="city" />
      <OrbitControls enableDamping dampingFactor={0.05} minDistance={2} maxDistance={20} />
    </>
  );
}

// ─── Generate sample PNG on canvas ───

function generateSamplePng(type: 'star' | 'logo' | 'text'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  if (type === 'star') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const cx = 128, cy = 128, outerR = 100, innerR = 40, points = 5;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      if (i === 0) ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      else ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fill();
  } else if (type === 'logo') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(128, 100, 60, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(128, 170); ctx.lineTo(60, 240); ctx.lineTo(196, 240); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 140px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('3D', 128, 128);
  }

  return canvas.toDataURL('image/png');
}

// ─── Main Component ───

// ─── Responsive Hook ───

function useIsMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

export default function PngTo3DExtruder() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [shapes, setShapes] = useState<THREE.Shape[]>([]);
  const [shapeResult, setShapeResult] = useState<ShapeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<MaterialPreset>('custom');
  const isMobile = useIsMobile();

  // Controls
  const [depth, setDepth] = useState(2);
  const [color, setColor] = useState('#c0c0c0');
  const [bevelEnabled] = useState(true);
  const [bevelThickness] = useState(0.05);
  const [bevelSize] = useState(0.03);
  const [metalness] = useState(0.7);
  const [roughness] = useState(0.3);
  const [wireframe, setWireframe] = useState(false);
  const [bgColor, setBgColor] = useState('#1a1a2e');
  const [useTexture, setUseTexture] = useState(true);
  const [textureQuality, setTextureQuality] = useState<TextureQuality>('mid');
  // Backlit LED controls
  const [showBackboard] = useState(true);
  const [backboardColor, setBackboardColor] = useState('#2a2a2a');
  const [ledColor, setLedColor] = useState('#ffffff');
  const [ledIntensity, setLedIntensity] = useState(2);
  const [standoffDistance, setStandoffDistance] = useState(0.3);
  const [ledSpread, setLedSpread] = useState(0.15);
  const [ledSpacing, setLedSpacing] = useState(0.8);
  const [boardPaddingX, setBoardPaddingX] = useState(0.6);
  const [boardPaddingY, setBoardPaddingY] = useState(0.5);
  const [boardDepth, setBoardDepth] = useState(0.2);
  // Light controls
  const [lightColor, setLightColor] = useState('#ffffff');
  const [lightIntensity, setLightIntensity] = useState(2);

  const downsample = TEXTURE_PRESETS[textureQuality].downsample;
  const simplify = TEXTURE_PRESETS[textureQuality].simplify;

  // Apply material preset
  const applyPreset = useCallback((preset: Exclude<MaterialPreset, 'custom'>) => {
    const config = MATERIAL_PRESETS[preset];
    setColor(config.color);
    setDepth(config.depth);
    setBackboardColor(config.backboardColor);
    setLedColor(config.ledColor);
    setLedIntensity(config.ledIntensity);
    setLedSpacing(config.ledSpacing);
    setStandoffDistance(config.standoffDistance);
    setLedSpread(config.ledSpread);
    setBoardPaddingX(config.boardPaddingX);
    setBoardPaddingY(config.boardPaddingY);
    setBoardDepth(config.boardDepth);
    setLightColor(config.lightColor);
    setLightIntensity(config.lightIntensity);
    setCurrentPreset(preset);
  }, []);

  const processImage = useCallback(
    (url: string) => {
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

          const result = pngToShapes(imageData, 0.02, downsample, simplify);

          if (result.shapes.length === 0) {
            setError('불투명 영역을 찾을 수 없습니다. PNG에 투명 영역이 있는지 확인하세요.');
            setShapes([]);
            setShapeResult(null);
          } else {
            setShapes(result.shapes);
            setShapeResult(result);
            setError(null);
          }

          if (useTexture) {
            const tex = new THREE.TextureLoader().load(url, (loadedTex) => {
              loadedTex.colorSpace = THREE.SRGBColorSpace;
              loadedTex.flipY = false;
              loadedTex.wrapS = THREE.ClampToEdgeWrapping;
              loadedTex.wrapT = THREE.ClampToEdgeWrapping;
              loadedTex.minFilter = THREE.LinearFilter;
              loadedTex.magFilter = THREE.LinearFilter;
              loadedTex.needsUpdate = true;
            });
            setTexture(tex);
          } else {
            setTexture(null);
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
    },
    [downsample, simplify, useTexture],
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/png')) {
        setError('PNG 파일만 업로드 가능합니다');
        return;
      }
      const url = URL.createObjectURL(file);
      setImageUrl(url);
    },
    [],
  );

  const handleSample = useCallback((type: 'star' | 'logo' | 'text') => {
    const url = generateSamplePng(type);
    setImageUrl(url);
  }, []);

  // Load default image on mount
  useEffect(() => {
    setImageUrl('/images/test.png');
  }, []);

  // Track manual changes to mark as custom preset
  useEffect(() => {
    if (currentPreset !== 'custom') {
      const preset = MATERIAL_PRESETS[currentPreset as Exclude<MaterialPreset, 'custom'>];
      if (preset) {
        const hasChanges =
          color !== preset.color ||
          depth !== preset.depth ||
          backboardColor !== preset.backboardColor ||
          ledColor !== preset.ledColor ||
          ledIntensity !== preset.ledIntensity;

        if (hasChanges) {
          setCurrentPreset('custom');
        }
      }
    }
  }, [color, depth, backboardColor, ledColor, ledIntensity, currentPreset]);

  // Process image whenever imageUrl or params change
  useEffect(() => {
    if (imageUrl) {
      processImage(imageUrl);
    }
  }, [imageUrl, processImage]);

  // Controls panel content (shared between mobile & desktop)
  const controlsContent = (
    <>
      {/* 이미지 소스 */}
      <Section title="이미지 소스">
        <label
          style={{
            display: 'block', padding: '12px',
            border: '2px dashed rgba(255,255,255,0.2)', borderRadius: '8px',
            textAlign: 'center', cursor: 'pointer', fontSize: '14px',
          }}
        >
          <input type="file" accept="image/png" onChange={handleFileUpload} style={{ display: 'none' }} />
          PNG 파일 업로드
        </label>
        <div style={{ marginTop: '12px', fontSize: '13px', opacity: 0.5, textAlign: 'center' }}>
          또는 샘플 선택:
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <SampleButton onClick={() => handleSample('star')} label="별" />
          <SampleButton onClick={() => handleSample('logo')} label="로고" />
          <SampleButton onClick={() => handleSample('text')} label="텍스트" />
        </div>
      </Section>

      {/* 소재 프리셋 */}
      <Section title="소재 프리셋">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {(['metal-channel', 'neon-sign', 'acrylic'] as const).map((presetKey) => {
            const preset = MATERIAL_PRESETS[presetKey];
            const isActive = currentPreset === presetKey;
            return (
              <button
                key={presetKey}
                onClick={() => applyPreset(presetKey)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  border: isActive ? '2px solid #4a90d9' : '1px solid rgba(255,255,255,0.15)',
                  background: isActive ? 'rgba(74,144,217,0.25)' : 'rgba(255,255,255,0.06)',
                  color: isActive ? '#8ab8e8' : '#999',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '24px' }}>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '8px', textAlign: 'center' }}>
          프리셋 선택 시 아래 설정이 자동 적용됩니다
        </div>
      </Section>

      {/* 형상 */}
      <Section title="형상">
        <Stepper label="두께" value={depth} min={1} max={3} step={0.1} onChange={setDepth} />
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '13px', marginBottom: '6px' }}>텍스처 품질</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['low', 'mid', 'high'] as TextureQuality[]).map((q) => (
              <button
                key={q}
                onClick={() => setTextureQuality(q)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: textureQuality === q ? 600 : 400,
                  border: textureQuality === q ? '2px solid #4a90d9' : '1px solid rgba(255,255,255,0.15)',
                  background: textureQuality === q ? 'rgba(74,144,217,0.25)' : 'rgba(255,255,255,0.06)',
                  color: textureQuality === q ? '#8ab8e8' : '#999',
                  transition: 'all 0.15s',
                }}
              >
                {TEXTURE_PRESETS[q].label}
              </button>
            ))}
          </div>
        </div>
        <Toggle label="와이어프레임" value={wireframe} onChange={setWireframe} />
      </Section>

      {/* 간판 설정 */}
      <Section title="간판 설정">
        <ColorPicker label="간판 색상" value={backboardColor} onChange={setBackboardColor} />
        <Stepper label="간판 여백 (좌우)" value={boardPaddingX} min={-2} max={3} step={0.1} onChange={setBoardPaddingX} />
        <Stepper label="간판 여백 (상하)" value={boardPaddingY} min={-2} max={3} step={0.1} onChange={setBoardPaddingY} />
        <Stepper label="간판 두께" value={boardDepth} min={0.02} max={0.5} step={0.02} onChange={setBoardDepth} />
      </Section>

      {/* LED 설정 */}
      <Section title="LED 설정">
        <ColorPicker label="LED 색상" value={ledColor} onChange={setLedColor} />
        <Stepper label="LED 밝기" value={ledIntensity} min={0} max={5} step={0.1} onChange={setLedIntensity} />
        <Stepper label="LED 간격" value={ledSpacing} min={0.3} max={3} step={0.1} onChange={setLedSpacing} />
        <Stepper label="이격 거리" value={standoffDistance} min={0.05} max={1.5} step={0.05} onChange={setStandoffDistance} />
        <Stepper label="빛 퍼짐" value={ledSpread} min={0.02} max={0.5} step={0.02} onChange={setLedSpread} />
      </Section>

      {/* 조명 */}
      <Section title="조명">
        <ColorPicker label="조명 색상" value={lightColor} onChange={setLightColor} />
        <Stepper label="조명 밝기" value={lightIntensity} min={0} max={3} step={0.1} onChange={setLightIntensity} />
      </Section>

      {/* 장면 */}
      <Section title="장면">
        <ColorPicker label="배경색" value={bgColor} onChange={setBgColor} />
      </Section>

      {/* 상태 표시 */}
      {loading && (
        <div style={{ padding: '12px', background: 'rgba(74,144,217,0.2)', borderRadius: '8px', fontSize: '13px', marginTop: '12px' }}>
          이미지 처리 중...
        </div>
      )}
      {error && (
        <div style={{ padding: '12px', background: 'rgba(217,74,74,0.2)', borderRadius: '8px', fontSize: '13px', marginTop: '12px', color: '#ff6b6b' }}>
          {error}
        </div>
      )}
      {shapes.length > 0 && !loading && (
        <div style={{ padding: '12px', background: 'rgba(74,217,100,0.15)', borderRadius: '8px', fontSize: '13px', marginTop: '12px', color: '#6bff8a' }}>
          {shapes.length}개 도형 추출 완료
        </div>
      )}
    </>
  );

  // 3D Viewport content
  const viewportContent = (
    <>
      {shapes.length === 0 && !loading ? (
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '12px', opacity: 0.4,
          }}
        >
          <svg width={isMobile ? '48' : '64'} height={isMobile ? '48' : '64'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p style={{ fontSize: isMobile ? '14px' : '16px', textAlign: 'center', padding: '0 20px' }}>
            PNG 파일을 업로드하거나 샘플을 선택하세요
          </p>
        </div>
      ) : (
        <Canvas shadows camera={{ position: [0, 2, 6], fov: 50 }} style={{ background: bgColor }}>
          <Scene
            shapes={shapes} shapeResult={shapeResult}
            depth={depth} color={color}
            bevelEnabled={bevelEnabled} bevelThickness={bevelThickness} bevelSize={bevelSize}
            metalness={metalness} roughness={roughness}
            wireframe={wireframe} texture={texture} bgColor={bgColor}
            showBackboard={showBackboard} backboardColor={backboardColor}
            ledColor={ledColor} ledIntensity={ledIntensity}
            standoffDistance={standoffDistance} ledSpread={ledSpread}
            boardPaddingX={boardPaddingX} boardPaddingY={boardPaddingY} boardDepth={boardDepth}
            lightColor={lightColor} lightIntensity={lightIntensity} ledSpacing={ledSpacing}
          />
        </Canvas>
      )}
    </>
  );

  // ─── MOBILE LAYOUT ───
  if (isMobile) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: bgColor, color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>3D 간판 시뮬레이터</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.6, fontSize: '12px' }}>PNG 알파 채널 기반 3D 입체 간판</p>
          </div>
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            style={{
              padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
              background: panelOpen ? 'rgba(74,144,217,0.3)' : 'rgba(255,255,255,0.08)',
              color: '#e0e0e0', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {panelOpen
                ? <path d="M18 6L6 18M6 6l12 12" />
                : <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>
              }
            </svg>
            {panelOpen ? '닫기' : '설정'}
          </button>
        </div>

        {/* 3D Viewport */}
        <div style={{ width: '100%', height: panelOpen ? '40vh' : 'calc(100vh - 60px)', position: 'relative', transition: 'height 0.3s ease' }}>
          {viewportContent}
        </div>

        {/* Controls Panel (slide up) */}
        {panelOpen && (
          <div style={{
            padding: '16px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            maxHeight: 'calc(60vh - 60px)',
          }}>
            {controlsContent}
          </div>
        )}
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───
  return (
    <div style={{ width: '100%', minHeight: '100vh', background: bgColor, color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '20px 30px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
          PNG to 3D 간판 시뮬레이터
        </h1>
        <p style={{ margin: '8px 0 0', opacity: 0.6, fontSize: '14px' }}>
          PNG 알파 채널 기반 3D 입체 간판 생성
        </p>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 85px)' }}>
        {/* Left Panel - Controls */}
        <div
          style={{
            width: '320px', flexShrink: 0, padding: '20px', overflowY: 'auto',
            borderRight: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)',
          }}
        >
          {controlsContent}
        </div>

        {/* Right Panel - 3D Viewport */}
        <div style={{ flex: 1, position: 'relative' }}>
          {viewportContent}
        </div>
      </div>
    </div>
  );
}

// ─── UI Sub-components ───

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.5, margin: '0 0 10px' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Stepper({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  const decrement = () => onChange(Math.max(min, parseFloat((value - step).toFixed(4))));
  const increment = () => onChange(Math.min(max, parseFloat((value + step).toFixed(4))));

  const btnStyle: React.CSSProperties = {
    width: '32px', height: '32px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.08)', color: '#e0e0e0', cursor: 'pointer',
    fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s', lineHeight: 1,
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '13px', marginBottom: '6px', opacity: 0.8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button style={btnStyle} onClick={decrement}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        >-</button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: 500,
          padding: '6px 0', background: 'rgba(255,255,255,0.05)', borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {value.toFixed(step < 1 ? 2 : 0)}
        </div>
        <button style={btnStyle} onClick={increment}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        >+</button>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginBottom: '10px', cursor: 'pointer' }}
      onClick={() => onChange(!value)}
    >
      <span>{label}</span>
      <div style={{
        width: '36px', height: '20px', borderRadius: '10px',
        background: value ? '#4a90d9' : 'rgba(255,255,255,0.15)',
        position: 'relative', transition: 'background 0.2s',
      }}>
        <div style={{
          width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
          position: 'absolute', top: '2px', left: value ? '18px' : '2px', transition: 'left 0.2s',
        }} />
      </div>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginBottom: '10px' }}>
      <span>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ opacity: 0.6, fontSize: '12px' }}>{value}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          style={{ width: '28px', height: '28px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
        />
      </div>
    </div>
  );
}

function SampleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '8px', background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
        color: '#e0e0e0', cursor: 'pointer', fontSize: '13px', transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
    >
      {label}
    </button>
  );
}
