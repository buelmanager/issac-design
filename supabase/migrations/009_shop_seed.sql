-- Shop 관련 목업 데이터 추가
-- landing_sections: featured bento 섹션
-- client_logos: 클라이언트 로고

INSERT INTO landing_sections (section_key, title, subtitle, is_visible, order_index, is_seed) VALUES
('shop_featured', '이달의 추천 제품', '가장 인기 있는 간판 제품을 만나보세요', true, 0, true)
ON CONFLICT (section_key) DO NOTHING;

INSERT INTO client_logos (name, logo_url, website_url, order_index, is_visible, is_seed) VALUES
('스타벅스 강남점', 'https://placehold.co/200x80/1f2937/ffffff?text=Starbucks', 'https://starbucks.co.kr', 0, true, true),
('투썸플레이스', 'https://placehold.co/200x80/8b5cf6/ffffff?text=A+TWOSOME', 'https://twosome.co.kr', 1, true, true),
('올리브영', 'https://placehold.co/200x80/059669/ffffff?text=OLIVE+YOUNG', 'https://oliveyoung.co.kr', 2, true, true),
('교촌치킨', 'https://placehold.co/200x80/dc2626/ffffff?text=KYOCHON', 'https://kyochon.com', 3, true, true),
('CU 편의점', 'https://placehold.co/200x80/7c3aed/ffffff?text=CU', 'https://cu.bgfretail.com', 4, true, true),
('이디야커피', 'https://placehold.co/200x80/1d4ed8/ffffff?text=EDIYA', 'https://ediya.com', 5, true, true);
