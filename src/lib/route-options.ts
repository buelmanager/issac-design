/**
 * 사이트 내부 페이지 경로 목록
 * 관리자 페이지에서 링크 드롭다운에 사용
 */

export interface RouteOption {
  value: string;
  label: string;
  group: string;
}

export const ROUTE_OPTIONS: RouteOption[] = [
  // 메인
  { value: '/', label: '홈', group: '메인' },

  // 쇼핑몰
  { value: '/shop', label: '쇼핑몰 메인', group: '쇼핑몰' },
  { value: '/shop/about', label: '회사 소개', group: '쇼핑몰' },
  { value: '/shop/portfolio', label: '포트폴리오', group: '쇼핑몰' },
  { value: '/shop/contact', label: '고객센터', group: '쇼핑몰' },
  { value: '/shop/faq', label: 'FAQ', group: '쇼핑몰' },
  { value: '/shop/search', label: '검색', group: '쇼핑몰' },

  // 견적 · 결제
  { value: '/shop/quote', label: '견적 문의', group: '견적 · 결제' },
  { value: '/shop/quote-cart', label: '견적함', group: '견적 · 결제' },
  { value: '/shop/quote-checkout', label: '견적 요청서', group: '견적 · 결제' },
  { value: '/shop/payment', label: '결제', group: '견적 · 결제' },

  // 마이페이지
  { value: '/shop/login', label: '로그인', group: '계정' },
  { value: '/shop/mypage', label: '마이페이지', group: '계정' },
  { value: '/shop/mypage/orders', label: '주문 내역', group: '계정' },
  { value: '/shop/mypage/quotes', label: '견적 내역', group: '계정' },
  { value: '/shop/mypage/profile', label: '프로필 수정', group: '계정' },

  // 기타
  { value: '/blog', label: '블로그', group: '기타' },
  { value: '/simulator', label: '3D 시뮬레이터', group: '기타' },
  { value: '/terms', label: '이용약관', group: '기타' },
  { value: '/privacy', label: '개인정보처리방침', group: '기타' },
];

/** 그룹별로 묶은 옵션 (드롭다운 optgroup 용) */
export function getGroupedRoutes(): Map<string, RouteOption[]> {
  const map = new Map<string, RouteOption[]>();
  for (const route of ROUTE_OPTIONS) {
    const existing = map.get(route.group) ?? [];
    existing.push(route);
    map.set(route.group, existing);
  }
  return map;
}
