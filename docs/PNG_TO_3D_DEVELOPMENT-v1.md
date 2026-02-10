# PNG to 3D Extrusion - 개발 문서

## 개요

PNG 이미지의 투명 부분(알파 채널)을 제거하고, 불투명한 부분만 실제 3D 입체 메쉬로 변환하는 기능.
후광 LED 간판(backlit channel letter) 시뮬레이션까지 포함.

**테스트 페이지**: `/test/png-to-3d`

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
│       └── contourUtils.ts          # RDP 단순화 + THREE.Shape 변환
└── pages/test/
    └── png-to-3d.astro              # Astro 테스트 페이지
```

---

## 핵심 알고리즘: Marching Squares

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
  │                               외곽선 + 내부 hole 모두 별도 contour로 생성
  ▼
simplifyPolygon()              ← Ramer-Douglas-Peucker 알고리즘으로 점 수 축소
  │
  ▼
THREE.ShapePath.toShapes()     ← CW/CCW 감지 → outer shape + hole 자동 할당
  │
  ▼
THREE.ExtrudeGeometry          ← 두께 있는 실제 3D 메쉬 생성
  │
  ▼
Auto-normalize                 ← Bounding box 기반 자동 크기 조절 (뷰포트에 맞춤)
```

### Marching Squares 상세 (`marchingSquares.ts`)

- **Cell 분류**: 2x2 픽셀 블록의 4개 모서리 → 4-bit index (0~15)
- **Edge Table**: 16가지 case에 대한 contour segment 룩업 테이블
- **Saddle Point** (case 5, 10): 중심값 기반 분기 처리 → 좁은 목 영역 정확 처리
- **Directed Edge Map**: 각 cell의 edge crossing → 방향성 있는 인접 맵 구축
- **Contour Tracing**: edge map 순회 → 자연 순서의 닫힌 폴리곤 추출

### 이전 방식과의 비교

| 항목 | 이전 (angle sorting) | 현재 (Marching Squares) |
|------|---------------------|------------------------|
| 볼록 형상 (Star) | OK | OK |
| 오목 형상 (Text) | 교차 폴리곤, 스파이크 | 정확한 형태 |
| Hole 처리 (D, O, B) | 미지원 (별도 shape) | 자동 감지 및 할당 |
| 복잡한 로고 | 깨짐 | 정확한 처리 |

---

## 후광 LED 간판 효과 (Backlit Channel Letter)

### 구성 요소

```
[간판 패널 (Backboard)]
       ↕ standoff (이격 거리)
[LED 광원 + Glow 레이어]
       ↕
[3D 글자 (Extruded Mesh)]
       ↓ 앞면 (카메라 방향)
```

1. **간판 패널 (Backboard)**: 글자 뒤의 평면 패널 (`boxGeometry`)
   - 색상 조절 가능
   - 글자 bounding box 기준 자동 크기 계산

2. **Standoff (이격 거리)**: 글자와 간판 사이의 거리
   - 거리가 클수록 빛이 더 넓게 퍼짐

3. **LED Glow 레이어**: 글자 실루엣을 약간 확대한 발광 메쉬
   - Custom ShaderMaterial (vertex + fragment shader)
   - `ledSpread`로 빛 퍼짐 범위 조절
   - 미세한 펄스 애니메이션 (sin wave)

4. **Point Lights**: 간판과 글자 사이에 배치된 조명
   - 중앙 + 좌우 3개 포인트 라이트
   - 간판 패널에 실제 빛 반사 생성

### LED Glow Shader

```glsl
// Fragment Shader
uniform vec3 uColor;       // LED 색상
uniform float uIntensity;  // 강도
uniform float uTime;       // 시간 (펄스용)

// 카메라 반대 방향 면이 더 밝게 → 후광 효과
float facingAway = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
float glow = pow(facingAway, 1.5) * uIntensity;
glow *= 0.9 + 0.1 * sin(uTime * 1.5);  // 미세 펄스
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
- **Color**: 글자 색상
- **Metalness** (0~1): 금속성
- **Roughness** (0~1): 거칠기
- **Wireframe** 토글

### Backlit LED Sign
- **Backboard** 토글: 간판 패널 표시/숨김
- **Board Color**: 간판 색상
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
  integrations: [react()]  // React 통합 추가
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
