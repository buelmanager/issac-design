/**
 * Chatbot Knowledge Base & Intent Matching
 * 제품 16종, FAQ 20개, 회사정보, 주문프로세스 + 키워드 기반 인텐트 매칭
 */

import productsData from './products.json';
import faqData from './shop-faq.json';

// =====================
// Types
// =====================
export type IntentType =
  | 'greeting'
  | 'product'
  | 'pricing'
  | 'order'
  | 'installation'
  | 'warranty'
  | 'contact'
  | 'general'
  | 'fallback';

export interface QuickReply {
  label: string;
  value: string;
}

export interface ProductCard {
  id: string;
  name: string;
  category: string;
  categoryName: string;
  priceRange: string;
  thumbnail: string;
  slug: string;
}

export interface ChatResponse {
  intent: IntentType;
  text: string;
  quickReplies: QuickReply[];
  productCards?: ProductCard[];
  actionButtons?: { label: string; type: 'tel' | 'kakao' | 'link'; href: string }[];
}

export interface ConversationContext {
  lastIntent: IntentType | null;
  interestedCategory: string | null;
}

// =====================
// Company Info
// =====================
export const companyInfo = {
  name: 'issac.design',
  phone: '070-8873-8472',
  kakao: '_issacdesign',
  kakaoUrl: 'https://pf.kakao.com/_issacdesign',
  email: 'info@issac.design',
  address: '서울특별시',
  hours: {
    weekday: '평일 09:00 - 18:00',
    saturday: '토요일 10:00 - 14:00',
    sunday: '일요일/공휴일 휴무',
  },
  experience: '15년',
  projects: '1,000건+',
};

// =====================
// Order Process
// =====================
export const orderProcess = [
  { step: 1, title: '문의 및 상담', desc: '전화, 카카오톡, 홈페이지를 통해 원하시는 제품과 요구사항을 알려주세요.' },
  { step: 2, title: '현장 조사 & 견적', desc: '필요시 현장을 방문하여 정확한 측정 후 상세 견적서를 제공합니다.' },
  { step: 3, title: '디자인 시안', desc: '전문 디자이너가 2-3개의 시안을 제작하며, 만족하실 때까지 수정합니다.' },
  { step: 4, title: '제작', desc: '확정된 디자인대로 자체 공장에서 정밀 제작합니다. (제품별 5-30일)' },
  { step: 5, title: '설치 & A/S', desc: '전문 기사가 현장 설치 후 1년 무상 A/S를 제공합니다.' },
];

// =====================
// Category Price Summary
// =====================
const categoryPrices: Record<string, { name: string; range: string }> = {
  'led-channel': { name: 'LED 채널 간판', range: '100만 ~ 500만원' },
  neon: { name: '네온 사인', range: '40만 ~ 200만원' },
  acrylic: { name: '아크릴 간판', range: '70만 ~ 250만원' },
  banner: { name: '현수막/배너', range: '5만 ~ 100만원' },
  protruding: { name: '돌출 간판', range: '100만 ~ 400만원' },
  rooftop: { name: '옥상 간판', range: '300만 ~ 2,000만원' },
};

// =====================
// Intent Keyword Patterns
// =====================
interface IntentPattern {
  intent: IntentType;
  keywords: string[];
  priority: number;
}

const intentPatterns: IntentPattern[] = [
  {
    intent: 'greeting',
    keywords: ['안녕', '하이', '헬로', 'hi', 'hello', '반갑', '처음', '시작'],
    priority: 1,
  },
  {
    intent: 'product',
    keywords: [
      'LED', 'led', '채널', '간판', '네온', '사인', '아크릴', '현수막', '배너',
      'X배너', '돌출', '옥상', '제품', '종류', '추천', '어떤', '뭐가', '상품',
      '카페', '매장', '음식점', '병원', '사무실', '레스토랑',
    ],
    priority: 3,
  },
  {
    intent: 'pricing',
    keywords: [
      '가격', '얼마', '비용', '단가', '견적', '금액', '예산', '저렴', '싼',
      '할인', '프로모션', '이벤트', '원',
    ],
    priority: 4,
  },
  {
    intent: 'order',
    keywords: [
      '주문', '주문하', '신청', '어떻게', '절차', '과정', '프로세스', '진행',
      '결제', '입금', '계약', '제작 기간', '기간', '며칠', '얼마나 걸',
    ],
    priority: 3,
  },
  {
    intent: 'installation',
    keywords: [
      '설치', '시공', '전국', '지방', '출장', '허가', '철거', '철거비',
      '건물주', '관리사무소', '옥외광고',
    ],
    priority: 3,
  },
  {
    intent: 'warranty',
    keywords: [
      '보증', 'A/S', 'AS', 'as', '수리', '고장', '교체', '유지보수', '점검',
      '무상', '유상', 'LED 나', '불량', '하자',
    ],
    priority: 3,
  },
  {
    intent: 'contact',
    keywords: [
      '전화', '연락', '번호', '카톡', '카카오', '이메일', 'email', '주소',
      '위치', '찾아', '영업시간', '운영시간', '상담원', '사람',
    ],
    priority: 2,
  },
  {
    intent: 'general',
    keywords: [
      '전기', '전기료', '전력', '트렌드', '유행', '포트폴리오', '시공사례',
      '후기', '재료', '소재', '실외', '실내', '밝기', '재제작',
    ],
    priority: 2,
  },
];

// =====================
// Product Helpers
// =====================
function getProductsByCategory(category: string): ProductCard[] {
  return productsData.products
    .filter((p) => p.category === category)
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      categoryName: p.categoryName,
      priceRange: p.priceRange,
      thumbnail: p.thumbnail,
      slug: p.slug,
    }));
}

function findProductsByKeyword(input: string): { category: string; products: ProductCard[] } | null {
  const lower = input.toLowerCase();
  const categoryMap: [string[], string][] = [
    [['led', '채널'], 'led-channel'],
    [['네온', '사인', 'neon'], 'neon'],
    [['아크릴'], 'acrylic'],
    [['현수막', '배너', 'x배너', '엑스배너'], 'banner'],
    [['돌출'], 'protruding'],
    [['옥상', '루프탑', '옥탑'], 'rooftop'],
  ];

  for (const [keywords, catId] of categoryMap) {
    if (keywords.some((k) => lower.includes(k))) {
      return { category: catId, products: getProductsByCategory(catId) };
    }
  }
  return null;
}

function findFaqAnswer(input: string): string | null {
  const lower = input.toLowerCase();
  for (const faq of faqData.faqs) {
    const qWords = faq.question.toLowerCase().split(/\s+/);
    const matchCount = qWords.filter((w) => w.length > 1 && lower.includes(w)).length;
    if (matchCount >= 2) return faq.answer;
  }
  return null;
}

// =====================
// Intent Matching
// =====================
function matchIntent(input: string, context: ConversationContext): IntentType {
  const lower = input.toLowerCase();
  const scores: { intent: IntentType; score: number }[] = [];

  for (const pattern of intentPatterns) {
    const matchCount = pattern.keywords.filter((k) => lower.includes(k.toLowerCase())).length;
    if (matchCount > 0) {
      scores.push({ intent: pattern.intent, score: matchCount * pattern.priority });
    }
  }

  if (scores.length === 0) return 'fallback';
  scores.sort((a, b) => b.score - a.score);

  // If context has interested category and user asks about pricing
  if (context.interestedCategory && scores[0].intent === 'pricing') {
    return 'pricing';
  }

  return scores[0].intent;
}

// =====================
// Response Generation
// =====================
export function generateResponse(input: string, context: ConversationContext): ChatResponse {
  const intent = matchIntent(input, context);

  switch (intent) {
    case 'greeting':
      return {
        intent,
        text: `안녕하세요! issac.design 간판 상담봇입니다.\n\n${companyInfo.experience} 경력, ${companyInfo.projects} 시공 경험을 바탕으로 최적의 간판을 추천해드릴게요.\n\n아래에서 궁금한 항목을 선택해주세요!`,
        quickReplies: [
          { label: '제품 추천', value: '어떤 제품이 있나요?' },
          { label: '가격 확인', value: '가격이 얼마예요?' },
          { label: '견적 문의', value: '견적은 어떻게 받나요?' },
          { label: '주문 방법', value: '주문은 어떻게 해요?' },
          { label: '설치 문의', value: '전국 설치 되나요?' },
          { label: '전화 상담', value: '전화번호 알려주세요' },
        ],
      };

    case 'product': {
      const found = findProductsByKeyword(input);
      if (found) {
        const catName = categoryPrices[found.category]?.name || found.category;
        context.interestedCategory = found.category;
        return {
          intent,
          text: `${catName} 제품을 안내해드릴게요!\n\n총 ${found.products.length}종의 제품이 있으며, 가격대는 ${categoryPrices[found.category]?.range}입니다.\n\n아래 제품 카드를 확인해보세요.`,
          quickReplies: [
            { label: '견적 문의', value: '견적 받고 싶어요' },
            { label: '다른 제품 보기', value: '다른 종류 제품도 있나요?' },
            { label: '설치 문의', value: '설치는 어떻게 되나요?' },
          ],
          productCards: found.products,
        };
      }

      // General product inquiry
      const allCategories = productsData.categories;
      const categoryList = allCategories
        .map((c) => `- **${c.name}**: ${c.description}`)
        .join('\n');

      return {
        intent,
        text: `issac.design에서는 6가지 카테고리, 총 16종의 간판 제품을 제공합니다.\n\n${categoryList}\n\n관심 있는 카테고리를 선택해주세요!`,
        quickReplies: allCategories.map((c) => ({
          label: c.name,
          value: `${c.name} 보여주세요`,
        })),
      };
    }

    case 'pricing': {
      if (context.interestedCategory) {
        const cat = categoryPrices[context.interestedCategory];
        if (cat) {
          return {
            intent,
            text: `${cat.name}의 가격 범위는 **${cat.range}**입니다.\n\n정확한 가격은 크기, 소재, 디자인에 따라 달라지므로 무료 견적을 받아보시는 것을 추천드려요!`,
            quickReplies: [
              { label: '무료 견적 받기', value: '견적 받고 싶어요' },
              { label: '다른 제품 가격', value: '다른 제품 가격도 알려주세요' },
              { label: '전화 상담', value: '전화번호 알려주세요' },
            ],
          };
        }
      }

      const priceTable = Object.values(categoryPrices)
        .map((c) => `- **${c.name}**: ${c.range}`)
        .join('\n');

      return {
        intent,
        text: `카테고리별 가격 범위를 안내해드릴게요.\n\n${priceTable}\n\n* 정확한 가격은 크기, 소재, 디자인에 따라 달라집니다.\n무료 견적으로 정확한 금액을 확인해보세요!`,
        quickReplies: [
          { label: '무료 견적 받기', value: '견적 받고 싶어요' },
          { label: 'LED 채널 간판', value: 'LED 채널 간판 보여주세요' },
          { label: '네온 사인', value: '네온 사인 보여주세요' },
          { label: '전화 상담', value: '전화번호 알려주세요' },
        ],
      };
    }

    case 'order': {
      const processText = orderProcess
        .map((p) => `**${p.step}. ${p.title}**\n${p.desc}`)
        .join('\n\n');

      return {
        intent,
        text: `주문은 아래 5단계로 진행됩니다.\n\n${processText}`,
        quickReplies: [
          { label: '견적 신청', value: '견적 받고 싶어요' },
          { label: '전화 상담', value: '전화번호 알려주세요' },
          { label: '카톡 문의', value: '카카오톡으로 문의하고 싶어요' },
        ],
      };
    }

    case 'installation': {
      const faqAnswer = findFaqAnswer(input);
      const text = faqAnswer ||
        '전국 어디든 설치 가능합니다!\n\n수도권은 물론 지방, 제주도까지 출장 설치가 가능하며, 지역에 따라 출장비가 추가될 수 있습니다.\n\n전문 설치 기사가 직접 방문하여 안전하게 시공하며, 기존 간판 철거도 함께 진행해드립니다.';

      return {
        intent,
        text,
        quickReplies: [
          { label: '견적 문의', value: '견적 받고 싶어요' },
          { label: '전화 상담', value: '전화번호 알려주세요' },
          { label: '철거 문의', value: '기존 간판 철거도 해주시나요?' },
        ],
      };
    }

    case 'warranty': {
      const faqAnswer = findFaqAnswer(input);
      const text = faqAnswer ||
        '설치 완료 후 **1년간 무상 A/S**를 제공합니다.\n\n- LED 모듈 초기 불량: 무상 교체\n- 제작/설치 하자: 무상 수리\n- 보증 기간 후: 합리적 비용으로 유상 수리\n- 정기 점검 서비스: 별도 계약 가능\n\n긴급한 경우 당일 출장 수리도 가능합니다!';

      return {
        intent,
        text,
        quickReplies: [
          { label: '유지보수 문의', value: '정기적인 유지보수가 필요한가요?' },
          { label: '수리 문의', value: 'LED가 나갔는데 수리 가능한가요?' },
          { label: '전화 상담', value: '전화번호 알려주세요' },
        ],
      };
    }

    case 'contact':
      return {
        intent,
        text: `issac.design 연락처 안내입니다.\n\n- **전화**: ${companyInfo.phone}\n- **카카오톡**: ${companyInfo.kakao}\n- **이메일**: ${companyInfo.email}\n\n**영업시간**\n- ${companyInfo.hours.weekday}\n- ${companyInfo.hours.saturday}\n- ${companyInfo.hours.sunday}`,
        quickReplies: [
          { label: '제품 둘러보기', value: '어떤 제품이 있나요?' },
          { label: '견적 문의', value: '견적 받고 싶어요' },
        ],
        actionButtons: [
          { label: '전화하기', type: 'tel', href: `tel:${companyInfo.phone}` },
          { label: '카톡 상담', type: 'kakao', href: companyInfo.kakaoUrl },
        ],
      };

    case 'general': {
      const faqAnswer = findFaqAnswer(input);
      if (faqAnswer) {
        return {
          intent,
          text: faqAnswer,
          quickReplies: [
            { label: '제품 보기', value: '어떤 제품이 있나요?' },
            { label: '가격 확인', value: '가격이 얼마예요?' },
            { label: '전화 상담', value: '전화번호 알려주세요' },
          ],
        };
      }

      return {
        intent: 'fallback',
        text: '죄송합니다, 정확한 답변을 드리기 어렵습니다.\n\n아래 항목 중 선택하시거나, 전문 상담원과 직접 상담해보세요!',
        quickReplies: [
          { label: '제품 문의', value: '어떤 제품이 있나요?' },
          { label: '가격 확인', value: '가격이 얼마예요?' },
          { label: '상담원 연결', value: '전화번호 알려주세요' },
        ],
        actionButtons: [
          { label: '전화하기', type: 'tel', href: `tel:${companyInfo.phone}` },
          { label: '카톡 상담', type: 'kakao', href: companyInfo.kakaoUrl },
        ],
      };
    }

    case 'fallback':
    default:
      return {
        intent: 'fallback',
        text: '죄송합니다, 질문을 정확히 이해하지 못했어요.\n\n아래에서 원하시는 항목을 선택해주시거나 다시 질문해주세요!',
        quickReplies: [
          { label: '제품 문의', value: '어떤 제품이 있나요?' },
          { label: '가격 확인', value: '가격이 얼마예요?' },
          { label: '주문 방법', value: '주문은 어떻게 해요?' },
          { label: '상담원 연결', value: '전화번호 알려주세요' },
        ],
        actionButtons: [
          { label: '전화하기', type: 'tel', href: `tel:${companyInfo.phone}` },
          { label: '카톡 상담', type: 'kakao', href: companyInfo.kakaoUrl },
        ],
      };
  }
}

export function getWelcomeResponse(): ChatResponse {
  return generateResponse('안녕하세요', { lastIntent: null, interestedCategory: null });
}
