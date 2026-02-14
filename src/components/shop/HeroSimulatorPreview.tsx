import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { marchingSquaresTrace } from '../simulator/lib/marchingSquares';
import { processContoursToShapes } from '../simulator/lib/contourUtils';
import { supabaseBrowser as supabase } from '../../lib/supabase-browser';

/**
 * HeroSimulatorPreview — Lightweight 3D signage preview for ShopHero
 * Extracts core rendering from ProductSimulator without controls UI.
 * Auto-loads test.png, auto-rotates, no user controls.
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

// ─── Image Processing (same as ProductSimulator) ───

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

function pngToShapes(imageData: ImageData): ShapeResult {
  const scale = 0.02;
  const downsampleFactor = 2;
  const simplifyEpsilon = 1.5;
  const rawMask = extractAlphaMask(imageData, 128);
  const mask = downsampleMask(rawMask, downsampleFactor);
  const h = mask.length;
  const w = mask[0].length;
  const contours = marchingSquaresTrace(mask);
  const shapes = processContoursToShapes(contours, w, h, scale, simplifyEpsilon);
  return { shapes, imageWidth: imageData.width, imageHeight: imageData.height, maskWidth: w, maskHeight: h, scale };
}

// ─── 3D Mesh (simplified from ProductSimulator) ───

function PreviewMesh({ shapes, shapeResult, texture }: { shapes: THREE.Shape[]; shapeResult: ShapeResult | null; texture: THREE.Texture | null }) {
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (glowRef.current && glowRef.current.material instanceof THREE.ShaderMaterial) {
      glowRef.current.material.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const depth = 2;
  const ledSpread = 0.15;
  const standoffDistance = 0.3;
  const boardPaddingX = 0.6;
  const boardPaddingY = -0.3;
  const boardDepth = 0.3;
  const ledColor = '#ffffff';
  const ledIntensity = 3;
  const ledSpacing = 0.8;

  const extrudeSettings = useMemo(
    () => ({ depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 5, steps: 2 }),
    [],
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
    const targetSize = 5;
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
  }, [shapes, shapeResult, extrudeSettings]);

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
  }, []);

  if (!computed) return null;

  const { geometry, glowGeometry, scale: autoScale, offset, size } = computed;
  const boardWidth = size.x * autoScale + boardPaddingX * 2;
  const boardHeight = size.y * autoScale + boardPaddingY * 2;

  const pointLights = useMemo(() => {
    const lights: { position: [number, number, number]; intensity: number }[] = [];
    if (ledSpacing <= 0) return lights;
    const usableWidth = boardWidth * 0.8;
    const usableHeight = boardHeight * 0.8;
    const cols = Math.max(1, Math.round(usableWidth / ledSpacing));
    const rows = Math.max(1, Math.round(usableHeight / ledSpacing));
    const dx = cols > 1 ? usableWidth / (cols - 1) : 0;
    const dy = rows > 1 ? usableHeight / (rows - 1) : 0;
    const zPos = -(standoffDistance * 0.6);
    const totalLeds = cols * rows;
    const perLedIntensity = ledIntensity * (3 / Math.sqrt(totalLeds));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = cols > 1 ? -usableWidth / 2 + col * dx : 0;
        const y = rows > 1 ? -usableHeight / 2 + row * dy : 0;
        lights.push({ position: [x, y, zPos], intensity: perLedIntensity });
      }
    }
    return lights;
  }, [boardWidth, boardHeight]);

  return (
    <group>
      {/* Backboard */}
      <mesh receiveShadow position={[0, 0, -(standoffDistance + depth * autoScale + 0.05)]}>
        <boxGeometry args={[boardWidth, boardHeight, boardDepth]} />
        <meshStandardMaterial color="#7a7a7a" metalness={0.1} roughness={0.8} />
      </mesh>

      {/* LED Glow */}
      <mesh ref={glowRef} geometry={glowGeometry} material={glowMaterial}
        scale={[autoScale, autoScale, autoScale]}
        position={[-offset.x * autoScale, -offset.y * autoScale, -(standoffDistance * 0.5) - offset.z * autoScale]}
      />
      {pointLights.map((light, idx) => (
        <pointLight key={idx} color={ledColor} intensity={light.intensity}
          distance={standoffDistance * 4 + 2} decay={2} position={light.position}
        />
      ))}

      {/* Main Mesh */}
      <mesh castShadow receiveShadow geometry={geometry}
        scale={[autoScale, autoScale, autoScale]}
        position={[-offset.x * autoScale, -offset.y * autoScale, -offset.z * autoScale]}
      >
        <meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.4} map={texture} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

// ─── Auto-rotate (always active, no user interaction reset) ───

const SWING_ANGLE = Math.PI / 3;
const ROTATE_SPEED = 0.15;

function AutoRotate() {
  const controlsRef = useRef<any>(null);
  const baseAzimuth = useRef(0);
  const direction = useRef(1);
  const currentOffset = useRef(0);
  const isIdle = useRef(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    isIdle.current = false;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (controlsRef.current) {
        baseAzimuth.current = controlsRef.current.getAzimuthalAngle();
        currentOffset.current = 0;
        direction.current = 1;
        isIdle.current = true;
      }
    }, 3000);
  }, []);

  useEffect(() => {
    if (controlsRef.current) {
      baseAzimuth.current = controlsRef.current.getAzimuthalAngle();
    }
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, []);

  useFrame((_, delta) => {
    if (!controlsRef.current || !isIdle.current) return;

    const step = ROTATE_SPEED * delta * direction.current;
    currentOffset.current += step;

    if (Math.abs(currentOffset.current) >= SWING_ANGLE / 2) {
      direction.current *= -1;
      currentOffset.current = Math.sign(currentOffset.current) * (SWING_ANGLE / 2);
    }

    const targetAngle = baseAzimuth.current + currentOffset.current;
    controlsRef.current.setAzimuthalAngle(targetAngle);
    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      enableZoom={false}
      enablePan={false}
      enableRotate={true}
      onStart={resetIdleTimer}
    />
  );
}

// ─── Scene ───

function PreviewScene({ shapes, shapeResult, texture }: { shapes: THREE.Shape[]; shapeResult: ShapeResult | null; texture: THREE.Texture | null }) {
  if (shapes.length === 0) return null;

  return (
    <>
      <ambientLight intensity={0.4} color="#ffffff" />
      <directionalLight position={[5, 5, 5]} intensity={2.5} color="#ffffff" castShadow />
      <directionalLight position={[-3, 3, -3]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[0, -2, 3]} intensity={0.6} color="#ffffff" />

      <PreviewMesh shapes={shapes} shapeResult={shapeResult} texture={texture} />

      <ContactShadows position={[0, -3, 0]} opacity={0.2} scale={15} blur={2} far={6} resolution={256} />
      <Environment preset="night" resolution={256} />
      <AutoRotate />
    </>
  );
}

// ─── Main Export ───

export default function HeroSimulatorPreview() {
  const [shapes, setShapes] = useState<THREE.Shape[]>([]);
  const [shapeResult, setShapeResult] = useState<ShapeResult | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [ready, setReady] = useState(false);

  const processImage = useCallback((url: string) => {
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
        const result = pngToShapes(imageData);
        if (result.shapes.length > 0) {
          setShapes(result.shapes);
          setShapeResult(result);
        }
        // Load texture
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
        setReady(true);
      } catch {
        setReady(true);
      }
    };
    img.onerror = () => setReady(true);
    img.src = url;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('simulator_config')
          .select('key, value')
          .eq('key', 'default_image')
          .single();
        if (cancelled) return;
        const url = data && typeof data.value === 'string' && data.value ? data.value : '/images/test.png';
        processImage(url);
      } catch {
        if (!cancelled) processImage('/images/test.png');
      }
    })();
    return () => { cancelled = true; };
  }, [processImage]);

  if (!ready || shapes.length === 0) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 32, height: 32, border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: 'rgba(76,175,80,0.6)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2, powerPreference: 'low-power' }}
        camera={{ position: [0, 0.5, 5], fov: 45 }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <PreviewScene shapes={shapes} shapeResult={shapeResult} texture={texture} />
      </Canvas>
    </div>
  );
}
