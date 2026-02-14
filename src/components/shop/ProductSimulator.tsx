import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { supabaseBrowser as supabase } from '../../lib/supabase-browser';
import { marchingSquaresTrace } from '../simulator/lib/marchingSquares';
import { processContoursToShapes } from '../simulator/lib/contourUtils';

/**
 * ProductSimulator - Full-featured 3D signage simulator
 * Ported from PngTo3DExtruder with shop theme integration
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


// ─── Texture Quality ───

type TextureQuality = 'low' | 'mid' | 'high';
const TEXTURE_PRESETS: Record<TextureQuality, { downsample: number; simplify: number; label: string }> = {
  low:  { downsample: 4, simplify: 3,   label: '하' },
  mid:  { downsample: 2, simplify: 1.5, label: '중' },
  high: { downsample: 1, simplify: 0.8, label: '상' },
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

// ─── Sample PNG Generator ───

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

// ─── 3D Components ───

interface ExtrudedMeshProps {
  shapes: THREE.Shape[];
  shapeResult: ShapeResult | null;
  depth: number;
  color: string;
  metalness: number;
  roughness: number;
  wireframe: boolean;
  texture: THREE.Texture | null;
  backboardColor: string;
  ledColor: string;
  ledIntensity: number;
  standoffDistance: number;
  ledSpread: number;
  boardPaddingX: number;
  boardPaddingY: number;
  boardDepth: number;
  ledSpacing: number;
  showBackboard: boolean;
}

function ExtrudedMesh({
  shapes, shapeResult, depth, color, metalness, roughness, wireframe, texture,
  backboardColor, ledColor, ledIntensity, standoffDistance, ledSpread,
  boardPaddingX, boardPaddingY, boardDepth, ledSpacing, showBackboard,
}: ExtrudedMeshProps) {
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (glowRef.current && glowRef.current.material instanceof THREE.ShaderMaterial) {
      glowRef.current.material.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const extrudeSettings = useMemo(
    () => ({ depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 5, steps: 2 }),
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
  }, [boardWidth, boardHeight, ledSpacing, standoffDistance, ledIntensity]);

  return (
    <group>
      {/* Backboard */}
      {showBackboard && (
        <mesh receiveShadow position={[0, 0, -(standoffDistance + depth * autoScale + 0.05)]}>
          <boxGeometry args={[boardWidth, boardHeight, boardDepth]} />
          <meshStandardMaterial color={backboardColor} metalness={0.1} roughness={0.8} />
        </mesh>
      )}

      {/* LED Glow */}
      {ledIntensity > 0 && (
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

      {/* Main Mesh */}
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

// ─── Auto-rotate orbit controller ───

const IDLE_TIMEOUT = 15000; // 15초 무조작 시 자동 회전 시작
const SWING_ANGLE = Math.PI / 3; // 60도
const ROTATE_SPEED = 0.15; // rad/s

function AutoRotateControls({ isAR }: { isAR: boolean }) {
  const controlsRef = useRef<any>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdle = useRef(true);
  const baseAzimuth = useRef(0);
  const direction = useRef(1);
  const currentOffset = useRef(0);

  const resetIdleTimer = useCallback(() => {
    isIdle.current = false;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!isAR && controlsRef.current) {
        baseAzimuth.current = controlsRef.current.getAzimuthalAngle();
        currentOffset.current = 0;
        direction.current = 1;
        isIdle.current = true;
      }
    }, IDLE_TIMEOUT);
  }, [isAR]);

  // 최초 로딩 시 자동 회전 시작
  useEffect(() => {
    if (!isAR) {
      isIdle.current = true;
      if (controlsRef.current) {
        baseAzimuth.current = controlsRef.current.getAzimuthalAngle();
      }
    }
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [isAR]);

  useFrame((_, delta) => {
    if (!controlsRef.current || isAR) return;
    if (!isIdle.current) return;

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
      minDistance={2}
      maxDistance={20}
      onStart={resetIdleTimer}
    />
  );
}

function Scene({ shapes, shapeResult, meshProps, lightColor, lightIntensity, bgColor, isNight, isAR, signPositionY }: {
  shapes: THREE.Shape[];
  shapeResult: ShapeResult | null;
  meshProps: Omit<ExtrudedMeshProps, 'shapes' | 'shapeResult'>;
  lightColor: string;
  lightIntensity: number;
  bgColor: string;
  isNight: boolean;
  isAR: boolean;
  signPositionY: number;
}) {
  if (shapes.length === 0) return null;

  const ambientIntensity = isAR ? 0.8 : isNight ? 0.35 : 0.6;
  const envPreset = isNight ? 'night' as const : 'city' as const;

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={lightColor} />
      <directionalLight position={[5, 5, 5]} intensity={isAR ? 2.0 : lightIntensity} color={lightColor} castShadow />
      <directionalLight position={[-3, 3, -3]} intensity={(isAR ? 2.0 : lightIntensity) * 0.4} color={lightColor} />
      <directionalLight position={[0, -2, 3]} intensity={(isAR ? 2.0 : lightIntensity) * 0.2} color={lightColor} />

      <group position={[0, signPositionY, 0]}>
        <ExtrudedMesh shapes={shapes} shapeResult={shapeResult} {...meshProps} />
      </group>

      {!isAR && <ContactShadows position={[0, -3, 0]} opacity={isNight ? 0.2 : 0.5} scale={15} blur={2} far={6} resolution={512} />}
      {!isAR && <Environment preset={envPreset} resolution={512} />}
      <AutoRotateControls isAR={isAR} />
    </>
  );
}

// ─── UI Sub-components ───

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="sim-section">
      <button className="sim-section__header" onClick={() => setOpen(!open)} type="button">
        <span className="sim-section__title">{title}</span>
        <svg className={`sim-section__arrow ${open ? 'open' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && <div className="sim-section__body">{children}</div>}
    </div>
  );
}

function Stepper({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="sim-stepper">
      <span className="sim-stepper__label">{label}</span>
      <div className="sim-stepper__controls">
        <button className="sim-stepper__btn" type="button"
          onClick={() => onChange(Math.max(min, parseFloat((value - step).toFixed(4))))}>-</button>
        <span className="sim-stepper__value">{value.toFixed(step < 1 ? 2 : 0)}</span>
        <button className="sim-stepper__btn" type="button"
          onClick={() => onChange(Math.min(max, parseFloat((value + step).toFixed(4))))}>+</button>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="sim-toggle" onClick={() => onChange(!value)}>
      <span className="sim-toggle__label">{label}</span>
      <div className={`sim-toggle__track ${value ? 'active' : ''}`}>
        <div className="sim-toggle__thumb" />
      </div>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="sim-color">
      <span className="sim-color__label">{label}</span>
      <div className="sim-color__input-wrap">
        <span className="sim-color__value">{value}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="sim-color__input" />
      </div>
    </div>
  );
}

// ─── Main Component ───

export default function ProductSimulator() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [shapes, setShapes] = useState<THREE.Shape[]>([]);
  const [shapeResult, setShapeResult] = useState<ShapeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Shape controls
  const depth = 2;
  const [color, setColor] = useState('#e0e0e0');
  const [wireframe, setWireframe] = useState(false);
  const [showBackboard, setShowBackboard] = useState(true);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const textureQuality: TextureQuality = 'mid';

  // Backboard controls
  const [backboardColor, setBackboardColor] = useState('#7a7a7a');
  const [boardPaddingX, setBoardPaddingX] = useState(0.6);
  const [boardPaddingY, setBoardPaddingY] = useState(-0.10);
  const boardDepth = 0.3;

  // Sign position
  const [signPositionY, setSignPositionY] = useState(0);

  // LED controls
  const [ledColor, setLedColor] = useState('#ffffff');
  const ledIntensity = 3;
  const [ledSpacing, setLedSpacing] = useState(0.8);
  const standoffDistance = 0.3;
  const ledSpread = 0.15;

  // Lighting controls
  const lightColor = '#ffffff';
  const lightIntensity = 2.5;

  // Scene controls
  const [bgColor, setBgColor] = useState('#0a0a1a');
  const [isNight, setIsNight] = useState(true);

  // Background image
  const [showBgImage, setShowBgImage] = useState(true);
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const [dbBgUrl, setDbBgUrl] = useState<string | null>(null);
  const [dbDefaultImage, setDbDefaultImage] = useState<string | null>(null);

  const handleBgUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (customBgUrl) URL.revokeObjectURL(customBgUrl);
    const url = URL.createObjectURL(file);
    setCustomBgUrl(url);
    setShowBgImage(true);
    e.target.value = '';
  }, [customBgUrl]);

  // AR mode
  const [isAR, setIsAR] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const downsample = TEXTURE_PRESETS[textureQuality].downsample;
  const simplify = TEXTURE_PRESETS[textureQuality].simplify;

  // ─── Debug Logger (console only) ───
  const dbg = useCallback((msg: string) => {
    console.log('[SIM-DBG]', msg);
  }, []);

  // 부모 요소들의 stacking context를 제거하여 position:fixed가 정상 동작하도록
  const savedStyles = useRef<{ el: HTMLElement; styles: Record<string, string> }[]>([]);

  const clearAncestorStyles = useCallback((el: HTMLElement) => {
    dbg('clearAncestorStyles: 시작');
    const saved: { el: HTMLElement; styles: Record<string, string> }[] = [];
    let parent = el.parentElement;
    let depth = 0;
    while (parent && parent !== document.body) {
      const computed = getComputedStyle(parent);
      const stylesToReset: Record<string, string> = {};
      const tag = `${parent.tagName}.${parent.className?.split?.(' ')?.[0] || 'no-class'}`;
      if (computed.transform !== 'none') {
        stylesToReset.transform = parent.style.transform;
        parent.style.transform = 'none';
        dbg(`  [${depth}] ${tag}: transform=${computed.transform} → none`);
      }
      if (computed.backdropFilter && computed.backdropFilter !== 'none') {
        stylesToReset.backdropFilter = parent.style.backdropFilter;
        (parent.style as any).backdropFilter = 'none';
        (parent.style as any).webkitBackdropFilter = 'none';
        dbg(`  [${depth}] ${tag}: backdropFilter → none`);
      }
      if (computed.filter && computed.filter !== 'none') {
        stylesToReset.filter = parent.style.filter;
        parent.style.filter = 'none';
        dbg(`  [${depth}] ${tag}: filter → none`);
      }
      if (computed.willChange && computed.willChange !== 'auto') {
        stylesToReset.willChange = parent.style.willChange;
        parent.style.willChange = 'auto';
        dbg(`  [${depth}] ${tag}: willChange → auto`);
      }
      if (computed.contain && computed.contain !== 'none') {
        stylesToReset.contain = parent.style.contain;
        parent.style.contain = 'none';
        dbg(`  [${depth}] ${tag}: contain → none`);
      }
      if (computed.overflow !== 'visible') {
        stylesToReset.overflow = parent.style.overflow;
        parent.style.overflow = 'visible';
        dbg(`  [${depth}] ${tag}: overflow=${computed.overflow} → visible`);
      }
      if (Object.keys(stylesToReset).length > 0) {
        saved.push({ el: parent, styles: stylesToReset });
      }
      parent = parent.parentElement;
      depth++;
    }
    savedStyles.current = saved;
    dbg(`clearAncestorStyles: 완료 (${saved.length}개 요소 수정)`);
  }, [dbg]);

  const restoreAncestorStyles = useCallback(() => {
    dbg(`restoreAncestorStyles: ${savedStyles.current.length}개 요소 복원`);
    savedStyles.current.forEach(({ el, styles }) => {
      const tag = `${el.tagName}.${el.className?.split?.(' ')?.[0] || ''}`;
      Object.entries(styles).forEach(([prop, val]) => {
        dbg(`  ${tag}: ${prop} → "${val || '(빈값)'}"`);
        (el.style as any)[prop] = val;
      });
    });
    savedStyles.current = [];
    dbg('restoreAncestorStyles: 완료');
  }, [dbg]);

  // 풀스크린 인라인 스타일 (CSS 클래스 대신 JS로 직접 적용)
  const savedCanvasStyle = useRef<string>('');

  const applyFullscreenStyles = useCallback((el: HTMLElement) => {
    savedCanvasStyle.current = el.style.cssText;
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.right = '0';
    el.style.bottom = '0';
    el.style.zIndex = '9999';
    el.style.width = '100vw';
    el.style.height = '100vh';
    el.style.maxWidth = 'none';
    el.style.maxHeight = 'none';
    el.style.minHeight = '0';
    el.style.borderRadius = '0';
    el.style.background = '#000';
    el.style.border = 'none';
    el.style.overflow = 'visible';
    el.style.transform = 'none';
    dbg('applyFullscreenStyles: 인라인 스타일 적용 완료');
  }, [dbg]);

  const removeFullscreenStyles = useCallback((el: HTMLElement) => {
    el.style.cssText = savedCanvasStyle.current;
    savedCanvasStyle.current = '';
    dbg('removeFullscreenStyles: 원래 스타일 복원');
  }, [dbg]);

  // Stop AR helper
  const stopAR = useCallback(() => {
    dbg('stopAR: 시작');
    if (streamRef.current) {
      dbg('stopAR: 카메라 스트림 정지');
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    // 전체화면 종료
    try {
      if (document.fullscreenElement) {
        dbg('stopAR: Fullscreen API 종료');
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitFullscreenElement) {
        dbg('stopAR: webkit Fullscreen 종료');
        (document as any).webkitExitFullscreen();
      }
    } catch (e) {
      dbg(`stopAR: fullscreen 종료 에러: ${e}`);
    }

    const el = canvasContainerRef.current;
    if (el) {
      const hadClass = el.classList.contains('ar-fullscreen');
      el.classList.remove('ar-fullscreen');
      removeFullscreenStyles(el);
      dbg(`stopAR: 풀스크린 스타일 제거 (클래스 있었음: ${hadClass})`);
    } else {
      dbg('stopAR: canvasContainerRef가 null!');
    }
    // 부모 스타일 복원
    restoreAncestorStyles();
    document.body.style.overflow = '';
    setIsAR(false);
    dbg('stopAR: 완료');
  }, [restoreAncestorStyles, removeFullscreenStyles, dbg]);

  // Start camera with given facing mode (triple fallback)
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('이 브라우저에서는 카메라를 지원하지 않습니다.');
    }

    let stream: MediaStream;
    // 1차: exact facingMode
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: mode } },
      });
    } catch {
      // 2차: ideal facingMode (반대)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode === 'environment' ? 'user' : 'environment' },
        });
      } catch {
        // 3차: 아무 카메라
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }
  }, []);

  // 전체화면 진입
  const enterFullscreen = useCallback(async () => {
    const el = canvasContainerRef.current;
    if (!el) {
      dbg('enterFullscreen: canvasContainerRef가 null!');
      return;
    }
    dbg(`enterFullscreen: 시작 (el=${el.tagName}.${el.className})`);

    // 캔버스 위치 정보 로깅
    const rect = el.getBoundingClientRect();
    dbg(`enterFullscreen: 캔버스 위치 top=${rect.top.toFixed(0)} left=${rect.left.toFixed(0)} w=${rect.width.toFixed(0)} h=${rect.height.toFixed(0)}`);

    // 1차: Fullscreen API (데스크탑/Android)
    try {
      if (el.requestFullscreen) {
        dbg('enterFullscreen: Fullscreen API 사용');
        await el.requestFullscreen();
        return;
      }
      if ((el as any).webkitRequestFullscreen) {
        dbg('enterFullscreen: webkit Fullscreen API 사용');
        await (el as any).webkitRequestFullscreen();
        return;
      }
    } catch (e) {
      dbg(`enterFullscreen: Fullscreen API 실패: ${e}`);
    }
    // 2차: JS 인라인 스타일로 풀스크린 (iOS/모바일)
    dbg('enterFullscreen: JS 인라인 스타일 폴백 사용');
    clearAncestorStyles(el);
    applyFullscreenStyles(el);
    el.classList.add('ar-fullscreen'); // :has() 셀렉터용
    document.body.style.overflow = 'hidden';

    // 적용 후 위치 확인
    requestAnimationFrame(() => {
      const newRect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      dbg(`enterFullscreen: 적용 후 pos=${cs.position} top=${newRect.top.toFixed(0)} left=${newRect.left.toFixed(0)} w=${newRect.width.toFixed(0)} h=${newRect.height.toFixed(0)}`);
    });
  }, [clearAncestorStyles, applyFullscreenStyles, dbg]);

  // 전체화면 종료
  const exitFullscreen = useCallback(() => {
    dbg('exitFullscreen: 시작');
    try {
      if (document.fullscreenElement) {
        dbg('exitFullscreen: Fullscreen API 종료');
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitFullscreenElement) {
        dbg('exitFullscreen: webkit Fullscreen 종료');
        (document as any).webkitExitFullscreen();
      }
    } catch (e) {
      dbg(`exitFullscreen: 에러: ${e}`);
    }
    const el = canvasContainerRef.current;
    if (el) {
      el.classList.remove('ar-fullscreen');
      removeFullscreenStyles(el);
    }
    restoreAncestorStyles();
    document.body.style.overflow = '';
    dbg('exitFullscreen: 완료');
  }, [restoreAncestorStyles, removeFullscreenStyles, dbg]);

  // AR camera toggle
  const toggleAR = useCallback(async () => {
    dbg(`toggleAR: isAR=${isAR}`);
    if (isAR) {
      dbg('toggleAR: AR 종료');
      stopAR();
    } else {
      setError(null);
      dbg('toggleAR: AR 시작 → enterFullscreen');
      // 먼저 전체화면 전환
      await enterFullscreen();
      setIsAR(true);
      dbg('toggleAR: isAR=true 설정, 카메라 시작 시도');

      // 카메라 시도 (실패해도 전체화면 유지)
      try {
        await startCamera(facingMode);
        dbg(`toggleAR: 카메라 시작 성공 (${facingMode})`);
      } catch (err: any) {
        const msg = err?.message || '';
        dbg(`toggleAR: 카메라 에러: ${msg}`);
        if (msg.includes('지원하지')) {
          setError(msg);
        } else if (msg.includes('NotAllowed') || msg.includes('Permission')) {
          setError('카메라 권한이 거부되었습니다. 설정에서 카메라를 허용해주세요.');
        } else {
          setError(`카메라 없이 전체화면 모드로 실행 중`);
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      }
    }
  }, [isAR, stopAR, startCamera, facingMode, enterFullscreen, dbg]);

  // Flip camera
  const flipCamera = useCallback(async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    try {
      await startCamera(nextMode);
      setFacingMode(nextMode);
    } catch (err) {
      console.error('Camera switch failed:', err);
    }
  }, [facingMode, startCamera]);

  // Handle fullscreen exit (ESC / back button)
  useEffect(() => {
    if (!isAR) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement && isAR) {
        stopAR();
      }
    };

    const handleBack = (e: PopStateEvent) => {
      e.preventDefault();
      stopAR();
    };

    window.history.pushState({ ar: true }, '');
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.addEventListener('popstate', handleBack);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('popstate', handleBack);
    };
  }, [isAR, stopAR]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Mount logging
  useEffect(() => {
    dbg('컴포넌트 마운트');
    const el = canvasContainerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      dbg(`캔버스 초기 위치: top=${rect.top.toFixed(0)} h=${rect.height.toFixed(0)} bottom=${rect.bottom.toFixed(0)}`);
      dbg(`window: ${window.innerWidth}x${window.innerHeight}, UA: ${navigator.userAgent.slice(0, 60)}`);
    }
    return () => dbg('컴포넌트 언마운트');
  }, [dbg]);

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
            setError('투명 배경이 있는 PNG 파일을 업로드해주세요.');
            setShapes([]);
            setShapeResult(null);
          } else {
            setShapes(result.shapes);
            setShapeResult(result);
            setError(null);
          }
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
    [downsample, simplify],
  );

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

  const handleSample = useCallback((type: 'star' | 'logo' | 'text') => {
    const url = generateSamplePng(type);
    setImageUrl(url);
  }, []);

  const handleLoadTestPng = useCallback(() => {
    setImageUrl(dbDefaultImage || '/images/test.png');
  }, [dbDefaultImage]);

  // Load settings from DB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('simulator_config')
          .select('key, value')
          .in('key', ['background_image', 'default_image']);
        if (cancelled) return;
        for (const row of data ?? []) {
          if (row.key === 'background_image' && typeof row.value === 'string' && row.value) setDbBgUrl(row.value);
          if (row.key === 'default_image' && typeof row.value === 'string' && row.value) setDbDefaultImage(row.value);
        }
        const defaultImg = (data ?? []).find(r => r.key === 'default_image');
        const imgVal = defaultImg && typeof defaultImg.value === 'string' && defaultImg.value ? defaultImg.value : '/images/test.png';
        setImageUrl(imgVal);
      } catch {
        if (!cancelled) setImageUrl('/images/test.png');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Process image
  useEffect(() => {
    if (imageUrl) processImage(imageUrl);
  }, [imageUrl, processImage]);

  const meshProps = {
    depth, color, metalness: 0.3, roughness: 0.4, wireframe, texture,
    backboardColor, ledColor, ledIntensity, standoffDistance, ledSpread,
    boardPaddingX, boardPaddingY, boardDepth, ledSpacing, showBackboard,
  };

  return (
    <div className="product-simulator">
      <div className="product-simulator__container">
        {/* Header + Image Source */}
        <div className="product-simulator__topbar">
          <div className="product-simulator__header">
            <h3 className="product-simulator__title">3D 시뮬레이터로 미리보기</h3>
            <p className="product-simulator__description">
              로고나 텍스트 이미지를 업로드하면 실제 간판 형태를 3D로 미리 확인할 수 있습니다.
              배경이 투명한 PNG 파일을 사용하면 가장 정확한 결과를 얻을 수 있으며,
              LED 조명, 백보드 색상 등 세부 설정도 자유롭게 조절해보세요.
            </p>
            <div className="product-simulator__tips">
              <span className="product-simulator__tips-desktop">마우스 드래그로 회전 · 스크롤로 확대/축소</span>
              <span className="product-simulator__tips-mobile">한 손가락으로 회전 · 두 손가락으로 이동/확대</span>
              <span className="product-simulator__tips-divider">|</span>
              <span>AR 모드로 실제 설치 장소에서 미리 확인</span>
            </div>
          </div>
        </div>

        {/* 3D Canvas - Full Width */}
        <div className="product-simulator__content">
          <div className={`product-simulator__canvas ${isAR ? 'ar-active' : ''}`} ref={canvasContainerRef}>
            {/* Background Image */}
            {showBgImage && !isAR && (
              <img
                className="sim-bg-image"
                src={customBgUrl || dbBgUrl || '/images/bg_sample.png'}
                alt=""
                decoding="async"
                width="1200"
                height="800"
                draggable={false}
              />
            )}

            {/* AR Camera Feed */}
            <video
              ref={videoRef}
              className="sim-ar-video"
              autoPlay
              playsInline
              muted
              style={{ display: isAR ? 'block' : 'none' }}
            />

            {shapes.length === 0 && !loading ? (
              <div className="product-simulator__empty">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17,8 12,3 7,8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p>PNG 파일을 업로드하거나 샘플을 선택하세요</p>
              </div>
            ) : (
              <Canvas shadows
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
                camera={{ position: [0, 0.5, 5.5], fov: 45 }}
                style={{ background: isAR || showBgImage ? 'transparent' : bgColor }}>
                <Scene shapes={shapes} shapeResult={shapeResult} meshProps={meshProps}
                  lightColor={lightColor} lightIntensity={lightIntensity} bgColor={bgColor} isNight={isNight} isAR={isAR} signPositionY={signPositionY} />
              </Canvas>
            )}

            {/* Day/Night Toggle */}
            <button
              className={`sim-daynight-btn ${isNight ? 'night' : 'day'}`}
              onClick={() => {
                const next = !isNight;
                setIsNight(next);
                setBgColor(next ? '#0a0a1a' : '#e8e8e8');
              }}
              type="button"
              data-tooltip={isNight ? '낮 모드' : '밤 모드'}
            >
              {isNight ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>

            {/* Wireframe Toggle */}
            <button
              className={`sim-canvas-btn sim-wireframe-btn ${wireframe ? 'active' : ''}`}
              onClick={() => setWireframe(!wireframe)}
              type="button"
              data-tooltip="와이어프레임"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </button>

            {/* Backboard Toggle */}
            <button
              className={`sim-canvas-btn sim-backboard-btn ${showBackboard ? 'active' : ''}`}
              onClick={() => setShowBackboard(!showBackboard)}
              type="button"
              data-tooltip="백보드"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                {!showBackboard && <line x1="3" y1="3" x2="21" y2="21"/>}
              </svg>
            </button>

            {/* Background Image Toggle */}
            <button
              className={`sim-canvas-btn sim-bgimage-btn ${showBgImage ? 'active' : ''}`}
              onClick={() => setShowBgImage(!showBgImage)}
              type="button"
              data-tooltip="배경 이미지"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>

            {/* Background Image Upload */}
            <label
              className="sim-canvas-btn sim-bgupload-btn"
              data-tooltip="배경 업로드"
            >
              <input type="file" accept="image/*" onChange={handleBgUpload} style={{ display: 'none' }} />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
                <line x1="16" y1="3" x2="16" y2="8"/>
                <line x1="13.5" y1="5.5" x2="18.5" y2="5.5"/>
              </svg>
            </label>

            {/* Board Settings Button + Popover */}
            <button
              className={`sim-canvas-btn sim-board-settings-btn ${showBoardSettings ? 'active' : ''}`}
              onClick={() => setShowBoardSettings(!showBoardSettings)}
              type="button"
              data-tooltip="간판 설정"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            {showBoardSettings && (
              <div className="sim-board-popover">
                <div className="sim-board-popover__header">
                  <span>간판 설정</span>
                  <button className="sim-board-popover__close" onClick={() => setShowBoardSettings(false)} type="button">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <ColorPicker label="간판 색상" value={backboardColor} onChange={setBackboardColor} />
                <div className="sim-board-popover__divider" />
                <Stepper label="크기 (좌우)" value={boardPaddingX} min={-2} max={3} step={0.2} onChange={setBoardPaddingX} />
                <Stepper label="크기 (상하)" value={boardPaddingY} min={-2} max={3} step={0.2} onChange={setBoardPaddingY} />
                <div className="sim-board-popover__divider" />
                <Stepper label="위치 (상하)" value={signPositionY} min={-5} max={5} step={0.2} onChange={setSignPositionY} />
                <div className="sim-board-popover__divider" />
                <ColorPicker label="LED 색상" value={ledColor} onChange={setLedColor} />
                <Stepper label="LED 간격" value={ledSpacing} min={0.3} max={3} step={0.1} onChange={setLedSpacing} />
              </div>
            )}

            {/* Sign Image Upload — left side */}
            <label
              className="sim-canvas-btn sim-sign-upload-btn"
              data-tooltip="간판 업로드"
            >
              <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/>
                <polyline points="14 2 14 8 20 8"/>
                <path d="M3 15h6"/>
                <path d="M6 12v6"/>
              </svg>
            </label>

            {/* AR Mode Button */}
            <button
              className={`sim-ar-btn ${isAR ? 'active' : ''}`}
              onClick={toggleAR}
              type="button"
              data-tooltip={isAR ? 'AR 끄기' : 'AR 모드'}
            >
              {isAR ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 7l4-4h4"/>
                  <path d="M14 3h4l4 4"/>
                  <path d="M22 17l-4 4h-4"/>
                  <path d="M10 21H6l-4-4"/>
                  <rect x="7" y="7" width="10" height="10" rx="1"/>
                  <path d="M12 10v4"/>
                  <path d="M10 12h4"/>
                </svg>
              )}
            </button>

            {/* AR CTA + Flip Camera */}
            {isAR && (
              <>
                <div className="sim-ar-cta">
                  <span>설치할 곳에 간판을 올려보세요</span>
                </div>
                <button
                  className="sim-ar-flip"
                  onClick={flipCamera}
                  type="button"
                  title="카메라 전환"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <polyline points="16 11 12 15 8 11"/>
                    <polyline points="8 13 12 9 16 13"/>
                  </svg>
                </button>
              </>
            )}

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

        </div>
      </div>

    </div>
  );
}
