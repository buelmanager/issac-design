INSERT INTO hero_slides (page, order_index, eyebrow, title_line1, title_line2, subtitle, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link, video_webm_url, video_url, poster_url, is_seed) VALUES
('landing', 0, 'SINCE 2010', '당신의 Brand를', 'Design하다', 'LED Signage · Neon Sign · Advertising Design - 당신의 브랜드를 가장 감각적으로', '쇼핑몰 둘러보기', '/shop', '포트폴리오 보기', '#portfolio', '/videos/hero1-opt.webm', '/videos/hero1-opt.mp4', '/videos/hero1-poster.jpg', true),
('landing', 1, 'LED SIGNAGE', '빛으로 만드는', 'Brand Identity', '최신 LED 기술로 브랜드의 가치를 높이는 Signage Solution을 제공합니다', 'LED 간판 보기', '/shop', '무료 상담 신청', '#contact', '/videos/hero2-opt.webm', '/videos/hero2-opt.mp4', '/videos/hero2-poster.jpg', true),
('landing', 2, 'NEON SIGN', 'Creative한', 'Neon Art', '감각적인 Neon Sign으로 공간에 특별한 Atmosphere를 더합니다', '네온사인 컬렉션', '/shop', '시공 사례 보기', '#portfolio', '/videos/hero3-opt.webm', '/videos/hero3-opt.mp4', '/videos/hero3-poster.jpg', true),
('landing', 3, 'TOTAL SOLUTION', 'Design부터', '시공까지 One-Stop', '기획 · Design · 제작 · 시공 · A/S까지, 하나의 흐름으로 완성합니다', '견적 문의하기', '#contact', '회사 소개', '#about', '/videos/hero4-opt.webm', '/videos/hero4-opt.mp4', '/videos/hero4-poster.jpg', true);

INSERT INTO hero_slides (page, order_index, eyebrow, title_line1, title_line2, subtitle, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link, is_seed) VALUES
('shop', 0, '감각적인 사인 디자인 · issac.design', '내 가게에 딱 맞는', '간판을 찾아보세요', 'LED 채널간판, 네온사인, 현수막, 돌출간판 등 온라인에서 비교하고 바로 견적받으세요', '제품 둘러보기', '#products', '무료 견적 문의', '/shop/quote', true),
('shop', 1, 'Premium Signage · issac.design', '브랜드의 첫인상을', '디자인합니다', '세련된 감각과 섬세한 디테일로 브랜드의 가치를 높이는 맞춤형 간판', '제품 둘러보기', '#products', '무료 견적 문의', '/shop/quote', true),
('shop', 2, 'Neon & LED · issac.design', '빛으로 완성하는', '당신의 브랜드', '네온사인부터 LED 채널까지 다양한 조명 간판으로 매장의 분위기를 만듭니다', '제품 둘러보기', '#products', '무료 견적 문의', '/shop/quote', true),
('shop', 3, 'Free Consultation · issac.design', '무료 상담으로', '시작하세요', '전문 디자이너의 1:1 맞춤 상담으로 최적의 간판을 제안받으세요', '제품 둘러보기', '#products', '무료 견적 문의', '/shop/quote', true);

INSERT INTO service_items (order_index, icon_key, title, description, is_visible, is_seed) VALUES
(0, 'design', 'Creative Design', '브랜드 아이덴티티를 담은 감각적인 사인 디자인으로 공간의 가치를 높입니다', true, true),
(1, 'led', 'LED Channel Sign', '최신 LED 기술과 정밀한 채널 가공으로 밤에도 빛나는 프리미엄 간판을 제작합니다', true, true),
(2, 'banner', 'Banner & Print', '대형 현수막, 배너, 실사출력 등 다양한 인쇄물을 빠르고 정확하게 제작합니다', true, true),
(3, 'outdoor', 'Outdoor Advertising', '건물 외벽, 돌출간판, 옥상광고 등 눈에 띄는 옥외광고를 설계하고 설치합니다', true, true),
(4, 'install', 'Installation', '안전한 설치를 위한 전문 시공팀이 현장 조건에 맞춰 완벽하게 설치합니다', true, true),
(5, 'quote', 'Easy Quotation', '온라인으로 간편하게 견적을 받아보세요. 빠른 상담과 합리적 가격을 약속합니다', true, true),
(6, 'support', 'After Service', '설치 이후에도 유지보수와 A/S를 지속적으로 제공합니다. 걱정 없이 맡겨주세요', true, true),
(7, 'fast', 'Fast Delivery', '자체 공장 운영으로 빠른 납기를 보장합니다. 급한 프로젝트도 문의해주세요', true, true);

INSERT INTO signage_types (order_index, number_label, title, description, link, image_url, is_visible, is_seed) VALUES
(0, '01', 'LED 채널 간판', '높은 가시성과 세련된 디자인의 LED 채널 간판으로 브랜드를 돋보이게 합니다', '/shop?category=led-channel', '/images/signage/led-channel.jpg', true, true),
(1, '02', '네온 사인', '감성적인 분위기를 연출하는 맞춤형 네온 사인으로 공간에 특별함을 더합니다', '/shop?category=neon', '/images/signage/neon.jpg', true, true),
(2, '03', '아크릴 간판', '깔끔하고 모던한 아크릴 간판으로 세련된 브랜드 이미지를 표현합니다', '/shop?category=acrylic', '/images/signage/acrylic.jpg', true, true),
(3, '04', '현수막/배너', '행사, 오픈, 세일 등 다양한 목적의 현수막과 배너를 제작합니다', '/shop?category=banner', '/images/signage/banner.jpg', true, true),
(4, '05', '돌출 간판', '건물 외벽에 설치하는 돌출 간판으로 원거리에서도 눈에 띄는 광고 효과를 제공합니다', '/shop?category=protruding', '/images/signage/protruding.jpg', true, true),
(5, '06', '옥상 간판', '건물 옥상에 설치하는 대형 간판으로 강력한 브랜드 존재감을 확보합니다', '/shop?category=rooftop', '/images/signage/rooftop.jpg', true, true);

INSERT INTO client_projects (order_index, category, name, project_type, image_url, is_visible, is_seed) VALUES
(0, 'restaurant', '고급 레스토랑 A', 'LED 채널 간판', '/images/clients/restaurant-a.jpg', true, true),
(1, 'restaurant', '이탈리안 레스토랑 B', '네온 사인', '/images/clients/restaurant-b.jpg', true, true),
(2, 'cafe', '감성 카페 C', '아크릴 간판', '/images/clients/cafe-c.jpg', true, true),
(3, 'retail', '패션 부티크 D', 'LED 채널 간판', '/images/clients/boutique-d.jpg', true, true),
(4, 'retail', '화장품 매장 E', '돌출 간판', '/images/clients/cosmetic-e.jpg', true, true),
(5, 'office', 'IT 스타트업 F', '실내 아크릴 간판', '/images/clients/startup-f.jpg', true, true),
(6, 'cafe', '디저트 카페 G', '네온 사인', '/images/clients/cafe-g.jpg', true, true),
(7, 'other', '대형 행사 H', '현수막/배너', '/images/clients/event-h.jpg', true, true);

INSERT INTO landing_faqs (order_index, question, answer, is_visible, is_seed) VALUES
(0, '주문 후 제작 기간은 얼마나 걸리나요?', '제품 종류와 사양에 따라 다르지만, 일반적으로 LED 채널간판은 7~10일, 네온사인은 5~7일, 실사출력물은 2~3일 정도 소요됩니다. 대형 프로젝트나 특수 사양의 경우 별도 협의가 필요합니다.', true, true),
(1, '시안(디자인) 수정은 몇 번까지 가능한가요?', '기본 2회 수정이 포함되어 있으며, 추가 수정이 필요한 경우 별도 비용이 발생할 수 있습니다. 초기 상담 시 원하는 디자인 방향을 상세히 알려주시면 수정 횟수를 줄일 수 있습니다.', true, true),
(2, '설치 비용은 별도인가요?', '네, 설치 비용은 설치 환경(층수, 크레인 필요 여부 등)에 따라 별도로 산정됩니다. 견적 요청 시 설치 장소 정보를 함께 보내주시면 설치비를 포함한 총 견적을 안내드립니다.', true, true),
(3, 'A/S 및 보증 기간은 어떻게 되나요?', 'LED 제품은 2년, 기타 제품은 1년의 무상 보증 기간을 제공합니다. 보증 기간 이후에도 합리적인 비용으로 수리 및 유지보수 서비스를 제공합니다.', true, true),
(4, '현장 방문 상담도 가능한가요?', '네, 서울/경기 지역은 무료 현장 방문 상담이 가능합니다. 그 외 지역은 상담 후 방문 여부를 협의합니다. 전화 또는 카카오톡으로 방문 일정을 예약해주세요.', true, true);

INSERT INTO trust_indicators (order_index, number_text, label, description, is_visible, is_seed) VALUES
(0, 'No.1', 'Design Sensibility', '세련된 감각으로 완성하는 사이니지', true, true),
(1, '1,000+', 'Unique Stories', '각기 다른 브랜드의 이야기를 담았습니다', true, true),
(2, '100%', 'Free Consultation', '브랜드에 맞는 최적의 제안을 드립니다', true, true),
(3, '24h', 'Always With You', '설치 이후에도 함께합니다', true, true);

INSERT INTO site_config (category, key, value, is_seed) VALUES
('company', 'name', 'issac.design', true),
('company', 'business_number', '123-45-67890', true),
('company', 'tagline', 'Your Brand, Our Craftsmanship', true),
('company', 'tagline_sub', 'LED Channel Letters · Neon Signage · Custom Fabrication', true),
('company', 'badge', '자체 제작 공장 보유', true),
('contact', 'phone', '010-1234-5678', true),
('contact', 'email', 'info@issac.design', true),
('contact', 'kakao', 'issac_design', true),
('contact', 'kakao_url', 'https://pf.kakao.com/issac_design', true),
('contact', 'address', '서울시 강남구 테헤란로 123 issac 빌딩 2층', true),
('contact', 'website', 'issac.design', true),
('contact', 'map_lat', '37.5012', true),
('contact', 'map_lng', '127.0396', true),
('contact', 'directions', '역삼역 3번 출구에서 도보 5분', true),
('hours', 'weekday', '09:00 ~ 18:00', true),
('hours', 'saturday', '10:00 ~ 15:00', true),
('hours', 'sunday', '휴무', true),
('sns', 'instagram', 'https://instagram.com/issac.design', true),
('sns', 'youtube', 'https://youtube.com/@issac.design', true),
('sns', 'blog', 'https://blog.naver.com/issac_design', true);

INSERT INTO navigation_items (nav_type, label, href, order_index, is_visible, is_seed) VALUES
('footer_quick', '홈', '/', 0, true, true),
('footer_quick', '서비스', '/#services', 1, true, true),
('footer_quick', 'FAQ', '/#faq', 2, true, true),
('footer_quick', '문의하기', '/#contact', 3, true, true),
('footer_service', '쇼핑몰', '/shop', 0, true, true),
('footer_service', '온라인 견적', '#contact', 1, true, true),
('footer_service', '포트폴리오', '#portfolio', 2, true, true),
('footer_service', 'A/S 문의', '#contact', 3, true, true),
('shop_contact_quick', '제품 둘러보기', '/shop', 0, true, true),
('shop_contact_quick', '회사 소개', '/shop/about', 1, true, true),
('shop_contact_quick', '자주 묻는 질문', '/shop/faq', 2, true, true);

INSERT INTO about_sections (section_key, content, is_seed) VALUES
('hero', '{"label": "About issac.design", "title": "공간에 감성을 더하다", "subtitle": "당신의 브랜드가 가진 고유한 이야기를, 빛과 형태로 표현합니다"}'::jsonb, true),
('mission', '{"quote": "좋은 간판은 단순한 표시가 아닙니다. 공간의 첫인상이자, 브랜드의 얼굴입니다.", "subtitle": "issac.design은 각 브랜드가 가진 고유한 감성을 읽고, 그에 어울리는 사인을 디자인합니다"}'::jsonb, true),
('values', '{"cards": [{"icon": "design", "title": "디자인", "desc": "트렌드를 읽고, 브랜드에 맞는 스타일을 제안합니다. 매장의 분위기와 조화를 이루는 감각적인 디자인을 추구합니다."}, {"icon": "detail", "title": "디테일", "desc": "소재 선택부터 조명 색온도까지, 작은 차이가 만드는 큰 인상. 세심한 디테일로 완성도를 높입니다."}, {"icon": "communication", "title": "소통", "desc": "고객의 비전을 정확히 이해하고, 디자인 과정을 함께합니다. 시안부터 설치까지 긴밀하게 소통합니다."}]}'::jsonb, true),
('story', '{"label": "Our Story", "title": "우리가 만드는 것", "paragraphs": ["issac.design은 ''잘 보이는 간판''이 아니라 ''잘 어울리는 간판''을 만듭니다. 매장의 분위기, 거리의 풍경, 브랜드가 지향하는 감성 — 이 모든 것을 고려한 디자인이 우리의 출발점입니다.", "디자인, 제작, 설치를 하나의 흐름으로 진행하면서 브랜드를 깊이 이해하는 과정을 가장 중요하게 생각합니다. 단순히 제품을 전달하는 것이 아니라, 고객의 이야기를 듣고 그에 맞는 형태와 빛을 찾아가는 과정입니다.", "우리는 공간과 사람을 잇는 사인을 만듭니다. 지나가는 이의 시선을 멈추게 하고, 브랜드에 대한 기대를 만들어내는 — 그런 간판을 목표로 합니다."]}'::jsonb, true),
('office', '{"label": "Our Space", "title": "우리가 일하는 공간", "description": "서울 성수동에 위치한 issac.design — 디자인, 제작, 소재 쇼룸이 하나로 연결된 공간입니다.", "sub": "방문 상담 환영합니다", "images": [{"label": "디자인 스튜디오", "url": "/images/about/office-1.jpg"}, {"label": "제작 공방", "url": "/images/about/office-2.jpg"}, {"label": "소재 쇼룸", "url": "/images/about/office-3.jpg"}, {"label": "고객 미팅룸", "url": "/images/about/office-4.jpg"}, {"label": "품질 검수", "url": "/images/about/office-5.jpg"}, {"label": "완제품 보관", "url": "/images/about/office-6.jpg"}]}'::jsonb, true),
('stats', '{"cards": [{"number": "15+", "label": "Years of Design", "desc": "디자인 감각을 다듬어온 시간"}, {"number": "1,000+", "label": "Unique Signs", "desc": "각기 다른 이야기를 담은 간판"}, {"number": "6", "label": "Product Lines", "desc": "다양한 스타일의 제품 라인업"}, {"number": "24h", "label": "Support", "desc": "설치 후에도 함께합니다"}]}'::jsonb, true),
('cta', '{"title": "당신의 브랜드에 어울리는 간판, 함께 만들어볼까요?", "button1": {"text": "무료 견적 문의", "href": "/shop/quote"}, "button2": {"text": "전화 상담", "href": "tel:070-8873-8472"}}'::jsonb, true);

INSERT INTO inquiry_types (order_index, label, value, is_visible, is_seed) VALUES
(0, 'LED 간판 제작', 'led', true, true),
(1, '현수막/배너 제작', 'banner', true, true),
(2, '옥외광고 제작', 'outdoor', true, true),
(3, '수리/A/S', 'repair', true, true),
(4, '기타 문의', 'other', true, true);

INSERT INTO site_config (category, key, value, is_seed) VALUES
('chatbot', 'order_process', '[{"step": 1, "title": "상담 및 견적", "desc": "온라인/전화/방문 상담으로 요구사항을 파악하고 견적을 안내드립니다"}, {"step": 2, "title": "디자인 시안", "desc": "브랜드에 맞는 디자인 시안을 2~3개 제안드립니다"}, {"step": 3, "title": "제작", "desc": "승인된 디자인으로 자체 공장에서 정밀 제작합니다"}, {"step": 4, "title": "설치", "desc": "전문 시공팀이 현장에 맞춰 안전하게 설치합니다"}, {"step": 5, "title": "A/S", "desc": "설치 후에도 유지보수와 A/S를 지속적으로 제공합니다"}]', true),
('chatbot', 'category_prices', '{"led-channel": {"name": "LED 채널 간판", "range": "30만원 ~ 200만원"}, "neon": {"name": "네온사인", "range": "15만원 ~ 80만원"}, "acrylic": {"name": "아크릴 간판", "range": "20만원 ~ 100만원"}, "banner": {"name": "현수막/배너", "range": "3만원 ~ 30만원"}, "protruding": {"name": "돌출 간판", "range": "40만원 ~ 150만원"}, "rooftop": {"name": "옥상 간판", "range": "100만원 ~ 500만원"}}', true);

INSERT INTO simulator_config (key, value, description, is_seed) VALUES
('background_images', '[]'::jsonb, '배경 이미지 목록 (벽돌, 야경 등)', true),
('color_palette', '["#FFFFFF","#000000","#FF0000","#00FF00","#0000FF"]'::jsonb, '기본 색상 팔레트', true),
('font_list', '["Noto Sans KR","Pretendard","Nanum Gothic"]'::jsonb, '사용 가능 폰트 목록', true),
('material_options', '[]'::jsonb, '소재 옵션 목록', true);

INSERT INTO project_filter_tabs (tab_key, label, order_index, is_visible, is_seed) VALUES
('all', '전체', 0, true, true),
('restaurant', '음식점', 1, true, true),
('cafe', '카페', 2, true, true),
('retail', '리테일', 3, true, true),
('office', '사무공간', 4, true, true),
('other', '기타', 5, true, true);

INSERT INTO product_categories (id, name, order_index, is_visible, is_seed) VALUES
('led-channel', 'LED 채널 간판', 0, true, true),
('neon', '네온 사인', 1, true, true),
('acrylic', '아크릴 간판', 2, true, true),
('banner', '현수막/배너', 3, true, true),
('protruding', '돌출 간판', 4, true, true),
('rooftop', '옥상 간판', 5, true, true);
