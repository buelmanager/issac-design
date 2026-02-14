# PNG to 3D Extrusion - 개발 문서 (v2)

## 개요

PNG 이미지의 투명 부분(알파 채널)을 제거하고, 불투명한 부분만 실제 3D 입체 메쉬로 변환하는 기능.
후광 LED 간판(backlit channel letter) 시뮬레이션 + 원본 텍스처 매핑 포함.

**테스트 페이지**: `/test/png-to-3d`

---

## v1 → v2 변경 사항

### 1. Hole 감지 알고리즘 개선

**이전 (v1)**: `THREE.ShapePath.toShapes()` 의존 — Y-flip 후 winding 방향 문제 발생 가능

**현재 (v2)**: 수동 winding + ray-casting 기반 containment 체크
- `signedArea()`: 폴리곤의 감긴 방향(CW/CCW) 판별
- `pointInPolygon()`: ray casting으로 포함 관계 판별
- 외곽 shape → CCW, hole → CW로 winding 정규화
- 면적 기준 내림차순 정렬 → 큰 shape부터 처리하여 hole 할당

### 2. 원본 PNG 텍스처 매핑

- geometry 좌표 → mask 좌표 → 이미지 UV로 정확한 역변환
- `flipY = false`, `ClampToEdge`, `LinearFilter` 설정
- "Use Texture" 토글 (기본 ON) — 원본 이미지 색상을 3D 메쉬에 매핑
- `computeVertexNormals()` 호출로 조명 정확도 향상

### 3. 간판 사이즈 실시간 조절

- **Board Padding X** (0~3): 좌우 여백 슬라이더
- **Board Padding Y** (0~3): 상하 여백 슬라이더
- **Board Depth** (0.02~0.5): 간판 두께 슬라이더

### 4. 자동 회전 제거 & 앞면 렌더링

- 자동 회전(rotation.y) 제거 → OrbitControls로 수동 조작만 허용
- `THREE.DoubleSide` → `THREE.FrontSide`로 변경 — 뒷면 미렌더링

---

## 기술 스택

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `three` | ^0.182.0 | 3D 렌더링 엔진 |
| `@react-three/fiber` | ^9.5.0 | React용 Three.js 바인딩 |
| `@react-three/drei` | ^10.7.7 | R3F 유틸리티 (OrbitControls, Environment 등) |
| `react` | ^19.2.4 | UI 프레임워크 |
| `@astrojs/react` | ^4.4.2 | Astro에서 React 컴포넌트 사용 |

---

## 파일 구조

```
src/
├── components/test/
│   ├── PngTo3DExtruder.tsx          # 메인 React 컴포넌트 (UI + 3D Scene)
│   └── lib/
│       ├── marchingSquares.ts       # Marching Squares 알고리즘
│       └── contourUtils.ts          # RDP 단순화 + Shape/Hole 변환
└── pages/test/
    └── png-to-3d.astro              # Astro 테스트 페이지
```

---

## 핵심 알고리즘

### 처리 흐름

```
PNG 파일
  │
  ▼
Canvas.getImageData()          ← RGBA 픽셀 데이터 추출
  │
  ▼
extractAlphaMask()             ← boolean[][] (alpha >= 128 → true)
  │
  ▼
downsampleMask()               ← 해상도 축소 (성능용, majority vote 방식)
  │
  ▼
marchingSquaresTrace()         ← 순서 보장된 닫힌 contour 폴리라인 추출
  │
  ▼
simplifyPolygon()              ← Ramer-Douglas-Peucker 알고리즘으로 점 수 축소
  │
  ▼
processContoursToShapes()      ← signedArea + pointInPolygon으로
  │                               outer(CCW) / hole(CW) 수동 분류
  ▼
THREE.ExtrudeGeometry          ← 두께 있는 실제 3D 메쉬 생성
  │
  ▼
UV Remapping                   ← geometry 좌표 → mask 좌표 → 이미지 UV 역변환
  │
  ▼
Auto-normalize                 ← Bounding box 기반 자동 크기 조절
```

### Marching Squares (`marchingSquares.ts`)

- **Cell 분류**: 2x2 픽셀 블록의 4개 모서리 → 4-bit index (0~15)
- **Edge Table**: 16가지 case에 대한 contour segment 룩업 테이블
- **Saddle Point** (case 5, 10): 중심값 기반 분기 처리
- **Directed Edge Map**: 방향성 있는 인접 맵 구축
- **Contour Tracing**: edge map 순회 → 닫힌 폴리곤 추출

### Shape/Hole 분류 (`contourUtils.ts`)

```
1. 모든 contour를 centered/scaled/Y-flipped 좌표로 변환
2. |signedArea|로 면적 계산 → 면적 내림차순 정렬
3. 큰 contour부터 순회:
   a. 이미 hole로 할당된 건 skip
   b. signedArea 부호로 CCW 보장 (outer shape)
   c. 더 작은 contour 중 첫 점이 내부에 있으면 → hole
   d. hole은 CW winding으로 정규화
4. THREE.Shape + shape.holes 구조 완성
```

### UV 매핑 (`PngTo3DExtruder.tsx`)

```
geometry 좌표 (gx, gy)
  │
  ├─ maskX = gx / geoScale + maskWidth / 2
  ├─ maskY = -(gy / geoScale) + maskHeight / 2
  │
  ├─ u = maskX / maskWidth      (0~1)
  └─ v = maskY / maskHeight     (0~1, flipY=false)
```

---

## 후광 LED 간판 효과 (Backlit Channel Letter)

### 구성 요소

```
[간판 패널 (Backboard)]     ← boardPaddingX/Y로 크기 조절, boardDepth로 두께 조절
       ↕ standoff (이격 거리)
[LED 광원 + Glow 레이어]
       ↕
[3D 글자 (Extruded Mesh)]   ← FrontSide 렌더링, 원본 텍스처 매핑
       ↓ 앞면 (카메라 방향)
```

1. **간판 패널 (Backboard)**: `boxGeometry`
   - `boardPaddingX/Y`: 글자 대비 간판 여백 (실시간 슬라이더)
   - `boardDepth`: 간판 두께 (실시간 슬라이더)

2. **Standoff (이격 거리)**: 글자와 간판 사이의 거리

3. **LED Glow 레이어**: Custom ShaderMaterial
   - `ledSpread`로 빛 퍼짐 범위 조절
   - 미세한 펄스 애니메이션 (`sin(uTime * 1.5)`)

4. **Point Lights**: 중앙 + 좌우 3개

### LED Glow Shader

```glsl
// Fragment Shader - 후광 효과
float facingAway = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
float glow = pow(facingAway, 1.5) * uIntensity;
glow *= 0.9 + 0.1 * sin(uTime * 1.5);  // 미세 펄스
gl_FragColor = vec4(uColor * glow, glow * 0.8);
```

---

## UI 컨트롤

### Image Source
- PNG 파일 업로드
- 샘플 선택: Star / Logo / Text

### Processing
- **Downsample** (1~6): 마스크 해상도 축소 비율
- **Simplify** (0.5~5): RDP 단순화 epsilon

### Geometry
- **Depth** (0.05~2): 돌출 두께
- **Bevel** 토글 + Thickness + Size

### Material
- **Use Texture** 토글 (기본 ON): 원본 PNG 색상 매핑
- **Color**: 단색 모드 시 글자 색상
- **Metalness** (0~1): 금속성
- **Roughness** (0~1): 거칠기
- **Wireframe** 토글

### Backlit LED Sign
- **Backboard** 토글: 간판 패널 표시/숨김
- **Board Color**: 간판 색상
- **Board Padding X** (0~3): 간판 좌우 여백
- **Board Padding Y** (0~3): 간판 상하 여백
- **Board Depth** (0.02~0.5): 간판 두께
- **LED Color**: LED 빛 색상
- **LED Intensity** (0~5): 빛 강도
- **Standoff** (0.05~1.5): 글자-간판 이격 거리
- **LED Spread** (0.02~0.5): 빛 퍼짐 범위

### Scene
- **Background**: 배경색

---

## 사용법

### 개발 서버 실행
```bash
npm run dev
# http://localhost:4321/test/png-to-3d
```

### PNG 요구사항
- **투명 배경** 필수 (alpha channel 있는 PNG)
- 불투명 부분이 3D로 변환됨
- 권장 크기: 256x256 ~ 1024x1024

### 실시간 미리보기
1. PNG 업로드 또는 샘플 선택
2. 자동으로 alpha → contour → 3D 변환
3. 파라미터 슬라이더로 실시간 조정
4. 마우스 드래그: 회전 / 스크롤: 줌 / 우클릭 드래그: 패닝

---

## Astro 설정 변경사항

### astro.config.mjs
```javascript
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()]
});
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

### 추가된 npm 패키지
```
@astrojs/react, react, react-dom, @types/react, @types/react-dom
three, @react-three/fiber, @react-three/drei, @types/three
```

---

## 향후 개선 가능 사항

- [ ] 네온 효과 (emissive + bloom post-processing)
- [ ] 금속 재질 프리셋 (스테인리스, 골드, 브론즈)
- [ ] 간판 배경 텍스처 (벽돌, 콘크리트, 나무)
- [ ] 야간/주간 모드 전환
- [ ] GLB/GLTF 내보내기 기능
- [ ] 여러 PNG 레이어 조합 (로고 + 텍스트)


                                                                          