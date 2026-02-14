-- Shop 섹션 관리를 위한 시드 데이터
-- hero_slides 비디오/이미지 포함 + landing_sections 섹션 헤더

-- 1. Shop hero slides가 없으면 생성 (비디오/이미지 포함)
INSERT INTO hero_slides (page, order_index, slide_index, eyebrow, title_line1, title_line2, subtitle, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link, video_url, video_webm_url, poster_url, is_seed)
SELECT 'shop', 0, 0, '감각적인 사인 디자인 · issac.design', '내 가게에 딱 맞는', '간판을 찾아보세요',
  'LED 채널간판, 네온사인, 현수막, 돌출간판 등 온라인에서 비교하고 바로 견적받으세요',
  '제품 둘러보기', '#products', '무료 견적 문의', '/shop/quote',
  '/videos/hero1-opt.mp4', '/videos/hero1-opt.webm', '/videos/hero1-poster.jpg', true
WHERE NOT EXISTS (SELECT 1 FROM hero_slides WHERE page = 'shop' AND order_index = 0);

INSERT INTO hero_slides (page, order_index, slide_index, eyebrow, title_line1, title_line2, subtitle, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link, video_url, video_webm_url, poster_url, is_seed)
SELECT 'shop', 1, 1, 'Premium Signage · issac.design', '브랜드의 첫인상을', '디자인합니다',
  '세련된 감각과 섬세한 디테일로 브랜드의 가치를 높이는 맞춤형 간판',
  '제품 둘러보기', '#products', '무료 견적 문의', '/shop/quote',
  '/videos/hero2-opt.mp4', '/videos/hero2-opt.webm', '/videos/hero2-poster.jpg', true
WHERE NOT EXISTS (SELECT 1 FROM hero_slides WHERE page = 'shop' AND order_index = 1);

INSERT INTO hero_slides (page, order_index, slide_index, eyebrow, title_line1, title_line2, subtitle, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link, video_url, video_webm_url, poster_url, is_seed)
SELECT 'shop', 2, 2, 'Neon & LED · issac.design', '빛으로 완성하는', '당신의 브랜드',
  '네온사인부터 LED 채널까지 다양한 조명 간판으로 매장의 분위기를 만듭니다',
  '제품 둘러보기', '#products', '무료 견적 문의', '/shop/quote',
  '/videos/hero3-opt.mp4', '/videos/hero3-opt.webm', '/videos/hero3-poster.jpg', true
WHERE NOT EXISTS (SELECT 1 FROM hero_slides WHERE page = 'shop' AND order_index = 2);

INSERT INTO hero_slides (page, order_index, slide_index, eyebrow, title_line1, title_line2, subtitle, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link, video_url, video_webm_url, poster_url, is_seed)
SELECT 'shop', 3, 3, 'Free Consultation · issac.design', '무료 상담으로', '시작하세요',
  '전문 디자이너의 1:1 맞춤 상담으로 최적의 간판을 제안받으세요',
  '제품 둘러보기', '#products', '무료 견적 문의', '/shop/quote',
  '/videos/hero4-opt.mp4', '/videos/hero4-opt.webm', '/videos/hero4-poster.jpg', true
WHERE NOT EXISTS (SELECT 1 FROM hero_slides WHERE page = 'shop' AND order_index = 3);

-- 2. 기존 Shop hero slides: slide_index 설정 + 비디오 URL 추가 (비어있는 경우)
UPDATE hero_slides SET slide_index = order_index WHERE page = 'shop' AND slide_index = 0 AND order_index > 0;
UPDATE hero_slides SET video_url = '/videos/hero1-opt.mp4', video_webm_url = '/videos/hero1-opt.webm', poster_url = '/videos/hero1-poster.jpg' WHERE page = 'shop' AND order_index = 0 AND video_url IS NULL;
UPDATE hero_slides SET video_url = '/videos/hero2-opt.mp4', video_webm_url = '/videos/hero2-opt.webm', poster_url = '/videos/hero2-poster.jpg' WHERE page = 'shop' AND order_index = 1 AND video_url IS NULL;
UPDATE hero_slides SET video_url = '/videos/hero3-opt.mp4', video_webm_url = '/videos/hero3-opt.webm', poster_url = '/videos/hero3-poster.jpg' WHERE page = 'shop' AND order_index = 2 AND video_url IS NULL;
UPDATE hero_slides SET video_url = '/videos/hero4-opt.mp4', video_webm_url = '/videos/hero4-opt.webm', poster_url = '/videos/hero4-poster.jpg' WHERE page = 'shop' AND order_index = 3 AND video_url IS NULL;

-- 3. Landing sections: Shop 섹션 헤더 추가
INSERT INTO landing_sections (section_key, title, subtitle, is_visible, order_index, is_seed) VALUES
('shop_new_arrivals', '신제품', '새롭게 출시된 제품을 만나보세요', true, 2, true),
('shop_products', '전체 제품', '다양한 간판 제품을 만나보세요', true, 3, true),
('shop_process', '주문 프로세스', '간판 제작, 이렇게 진행됩니다', true, 4, true),
('shop_trust', '왜 issac.design인가?', '감각적인 디자인과 세심한 소통으로 브랜드를 빛냅니다', true, 5, true),
('shop_clients', '다양한 공간에 어울리는 사인을 만듭니다', '카페, 레스토랑, 클리닉, 갤러리까지 각 공간의 분위기에 맞는 감각적인 사인을 디자인합니다', true, 6, true)
ON CONFLICT (section_key) DO NOTHING;
