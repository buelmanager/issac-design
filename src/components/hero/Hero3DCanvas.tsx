/**
 * Hero 3D Canvas - Full Simulator Integration
 * Uses PngTo3DExtruder logic with sample logo
 */
import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { marchingSquaresTrace } from '../simulator/lib/marchingSquares';
import { processContoursToShapes } from '../simulator/lib/contourUtils';

// Day/Night mode type
type ViewMode = 'day' | 'night';

// ─── Alpha mask extraction (from PngTo3DExtruder) ───

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

// ─── Generate sample logo ───

function generateSampleLogo(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  // Draw "M" shape for m-design
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 200px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', 128, 128);

  return canvas.toDataURL('image/png');
}

// ─── Extruded Mesh Component ───

interface ExtrudedMeshProps {
  shapes: THREE.Shape[];
  shapeResult: ShapeResult | null;
  depth: number;
  color: string;
  metalness: number;
  roughness: number;
  texture: THREE.Texture | null;
  backboardColor: string;
  ledColor: string;
  ledIntensity: number;
  ledSpread: number;
  mode: ViewMode;
}

function ExtrudedMesh({
  shapes,
  shapeResult,
  depth,
  color,
  metalness,
  roughness,
  texture,
  backboardColor,
  ledColor,
  ledIntensity,
  ledSpread,
  mode,
}: ExtrudedMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (glowRef.current && glowRef.current.material instanceof THREE.ShaderMaterial) {
      glowRef.current.material.uniforms.uTime.value = state.clock.elapsedTime;
    }
    // Gentle auto-rotation
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.15;
    }
  });

  const extrudeSettings = useMemo(
    () => ({ depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 3, steps: 1 }),
    [depth],
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

    if (shapeResult && texture) {
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
      depth: 0.01,
      bevelEnabled: true,
      bevelThickness: 0,
      bevelSize: ledSpread / s,
      bevelSegments: 8,
      steps: 1,
    });
    glowGeo.computeBoundingBox();

    return { geometry: geo, glowGeometry: glowGeo, scale: s, offset: center, size };
  }, [shapes, shapeResult, extrudeSettings, ledSpread, texture]);

  const glowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(ledColor) },
        uIntensity: { value: ledIntensity },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float edgeFactor = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
          float pulse = 0.5 + 0.5 * sin(uTime * 2.0);
          float alpha = edgeFactor * uIntensity * 0.3 * (0.8 + 0.2 * pulse);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
  }, [ledColor, ledIntensity]);

  if (!computed) return null;

  const { geometry, glowGeometry, scale, offset, size } = computed;

  return (
    <group ref={groupRef}>
      <group scale={scale} position={[-offset.x * scale, -offset.y * scale, -offset.z * scale]}>
        {/* Backboard */}
        <mesh position={[offset.x, offset.y, offset.z - 0.3]}>
          <boxGeometry args={[size.x + 0.6, size.y + 0.5, 0.2]} />
          <meshStandardMaterial color={backboardColor} metalness={0.3} roughness={0.7} />
        </mesh>

        {/* Main extruded sign */}
        <mesh geometry={geometry}>
          <meshStandardMaterial
            color={color}
            metalness={metalness}
            roughness={roughness}
            map={texture}
            envMapIntensity={1.5}
          />
        </mesh>

        {/* LED glow (Night mode only) */}
        {mode === 'night' && (
          <>
            <mesh ref={glowRef} geometry={glowGeometry} material={glowMaterial} position={[0, 0, -0.01]} />
            <pointLight position={[offset.x, offset.y, offset.z - 0.15]} color={ledColor} intensity={ledIntensity * 1.5} distance={5} decay={2} />
          </>
        )}
      </group>
    </group>
  );
}

// ─── Scene Component ───

interface SceneProps {
  mode: ViewMode;
  shapes: THREE.Shape[];
  shapeResult: ShapeResult | null;
  texture: THREE.Texture | null;
}

function Scene({ mode, shapes, shapeResult, texture }: SceneProps) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} />
      <ambientLight intensity={mode === 'night' ? 0.2 : 0.6} />
      <directionalLight position={[5, 5, 5]} intensity={mode === 'night' ? 0.5 : 2.0} castShadow />
      <directionalLight position={[-3, 3, -3]} intensity={mode === 'night' ? 0.3 : 1.0} />

      <ExtrudedMesh
        shapes={shapes}
        shapeResult={shapeResult}
        depth={2.5}
        color="#c0c0c0"
        metalness={0.9}
        roughness={0.1}
        texture={texture}
        backboardColor="#2a2a2a"
        ledColor="#ffffff"
        ledIntensity={mode === 'night' ? 2.5 : 0}
        ledSpread={0.15}
        mode={mode}
      />

      <ContactShadows position={[0, -2, 0]} opacity={mode === 'night' ? 0.3 : 0.5} scale={10} blur={2} far={4} />
      <Environment preset={mode === 'night' ? 'night' : 'city'} />
      <OrbitControls enablePan={false} enableZoom={true} minDistance={5} maxDistance={12} maxPolarAngle={Math.PI / 2} autoRotate={false} />
    </>
  );
}

// ─── Main Component ───

export default function Hero3DCanvas() {
  const [mode, setMode] = useState<ViewMode>('night');
  const [shapes, setShapes] = useState<THREE.Shape[]>([]);
  const [shapeResult, setShapeResult] = useState<ShapeResult | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Detect mobile and reduced motion
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    const checkReducedMotion = () => {
      setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };

    checkMobile();
    checkReducedMotion();

    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen for mode change events
  useEffect(() => {
    const handleModeChange = (e: CustomEvent<{ mode: ViewMode }>) => {
      setMode(e.detail.mode);
    };

    window.addEventListener('hero-mode-change', handleModeChange as EventListener);
    return () => {
      window.removeEventListener('hero-mode-change', handleModeChange as EventListener);
    };
  }, []);

  // Process sample logo on mount
  const processLogo = useCallback(() => {
    const url = generateSampleLogo();
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        const result = pngToShapes(imageData, 0.02, 2, 1.5);

        if (result.shapes.length > 0) {
          setShapes(result.shapes);
          setShapeResult(result);

          const tex = new THREE.TextureLoader().load(url);
          tex.colorSpace = THREE.SRGBColorSpace;
          setTexture(tex);
        }
      } catch (err) {
        console.error('Failed to process logo:', err);
      }
    };
    img.src = url;
  }, []);

  useEffect(() => {
    processLogo();
  }, [processLogo]);

  // Fallback for reduced motion
  if (prefersReducedMotion) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(26, 54, 93, 0.2) 100%)',
        }}
      >
        <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
          <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>3D 간판 미리보기</p>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Interactive 3D model</p>
        </div>
      </div>
    );
  }

  if (shapes.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(26, 54, 93, 0.2) 100%)',
        }}
      >
        <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows={!isMobile}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        gl={{
          antialias: !isMobile,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        performance={{ min: 0.5 }}
        style={{
          background:
            mode === 'night'
              ? 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(26, 54, 93, 0.2) 100%)'
              : 'linear-gradient(135deg, rgba(135, 206, 235, 0.3) 0%, rgba(255, 255, 255, 0.4) 100%)',
          transition: 'background 0.8s ease',
        }}
      >
        <Scene mode={mode} shapes={shapes} shapeResult={shapeResult} texture={texture} />
      </Canvas>
    </div>
  );
}
