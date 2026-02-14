/**
 * Seed shop sections data into Supabase
 * Run: node scripts/seed-shop-sections.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY
);

async function seed() {
  console.log('Seeding shop sections...');

  // 1. Check if shop hero slides exist
  const { data: existingSlides } = await supabase
    .from('hero_slides')
    .select('id, order_index')
    .eq('page', 'shop')
    .order('order_index');

  const shopSlides = [
    {
      page: 'shop', order_index: 0, slide_index: 0,
      eyebrow: '감각적인 사인 디자인 · issac.design',
      title_line1: '내 가게에 딱 맞는', title_line2: '간판을 찾아보세요',
      subtitle: 'LED 채널간판, 네온사인, 현수막, 돌출간판 등 온라인에서 비교하고 바로 견적받으세요',
      cta_primary_text: '제품 둘러보기', cta_primary_link: '#products',
      cta_secondary_text: '무료 견적 문의', cta_secondary_link: '/shop/quote',
      video_url: '/videos/hero1-opt.mp4', video_webm_url: '/videos/hero1-opt.webm', poster_url: '/videos/hero1-poster.jpg',
      is_seed: true,
    },
    {
      page: 'shop', order_index: 1, slide_index: 1,
      eyebrow: 'Premium Signage · issac.design',
      title_line1: '브랜드의 첫인상을', title_line2: '디자인합니다',
      subtitle: '세련된 감각과 섬세한 디테일로 브랜드의 가치를 높이는 맞춤형 간판',
      cta_primary_text: '제품 둘러보기', cta_primary_link: '#products',
      cta_secondary_text: '무료 견적 문의', cta_secondary_link: '/shop/quote',
      video_url: '/videos/hero2-opt.mp4', video_webm_url: '/videos/hero2-opt.webm', poster_url: '/videos/hero2-poster.jpg',
      is_seed: true,
    },
    {
      page: 'shop', order_index: 2, slide_index: 2,
      eyebrow: 'Neon & LED · issac.design',
      title_line1: '빛으로 완성하는', title_line2: '당신의 브랜드',
      subtitle: '네온사인부터 LED 채널까지 다양한 조명 간판으로 매장의 분위기를 만듭니다',
      cta_primary_text: '제품 둘러보기', cta_primary_link: '#products',
      cta_secondary_text: '무료 견적 문의', cta_secondary_link: '/shop/quote',
      video_url: '/videos/hero3-opt.mp4', video_webm_url: '/videos/hero3-opt.webm', poster_url: '/videos/hero3-poster.jpg',
      is_seed: true,
    },
    {
      page: 'shop', order_index: 3, slide_index: 3,
      eyebrow: 'Free Consultation · issac.design',
      title_line1: '무료 상담으로', title_line2: '시작하세요',
      subtitle: '전문 디자이너의 1:1 맞춤 상담으로 최적의 간판을 제안받으세요',
      cta_primary_text: '제품 둘러보기', cta_primary_link: '#products',
      cta_secondary_text: '무료 견적 문의', cta_secondary_link: '/shop/quote',
      video_url: '/videos/hero4-opt.mp4', video_webm_url: '/videos/hero4-opt.webm', poster_url: '/videos/hero4-poster.jpg',
      is_seed: true,
    },
  ];

  if (!existingSlides || existingSlides.length === 0) {
    // Insert all shop slides
    const { error } = await supabase.from('hero_slides').insert(shopSlides);
    if (error) console.error('Hero slides insert error:', error.message);
    else console.log('✓ 4 shop hero slides created (with video URLs)');
  } else {
    // Update existing slides with video URLs if missing
    for (const slide of shopSlides) {
      const existing = existingSlides.find(s => s.order_index === slide.order_index);
      if (existing) {
        const { error } = await supabase.from('hero_slides').update({
          slide_index: slide.slide_index,
          video_url: slide.video_url,
          video_webm_url: slide.video_webm_url,
          poster_url: slide.poster_url,
        }).eq('id', existing.id).is('video_url', null);
        if (!error) console.log(`✓ Slide ${slide.order_index} updated`);
      }
    }
    console.log(`✓ ${existingSlides.length} existing shop hero slides checked`);
  }

  // 2. Insert landing sections for shop
  const sections = [
    { section_key: 'shop_new_arrivals', title: '신제품', subtitle: '새롭게 출시된 제품을 만나보세요', order_index: 2 },
    { section_key: 'shop_products', title: '전체 제품', subtitle: '다양한 간판 제품을 만나보세요', order_index: 3 },
    { section_key: 'shop_process', title: '주문 프로세스', subtitle: '간판 제작, 이렇게 진행됩니다', order_index: 4 },
    { section_key: 'shop_trust', title: '왜 issac.design인가?', subtitle: '감각적인 디자인과 세심한 소통으로 브랜드를 빛냅니다', order_index: 5 },
    { section_key: 'shop_clients', title: '다양한 공간에 어울리는 사인을 만듭니다', subtitle: '카페, 레스토랑, 클리닉, 갤러리까지 각 공간의 분위기에 맞는 감각적인 사인을 디자인합니다', order_index: 6 },
  ];

  for (const sec of sections) {
    const { data: existing } = await supabase
      .from('landing_sections')
      .select('id')
      .eq('section_key', sec.section_key)
      .single();

    if (!existing) {
      const { error } = await supabase.from('landing_sections').insert({
        ...sec,
        is_visible: true,
        is_seed: true,
      });
      if (error) console.error(`Section ${sec.section_key} error:`, error.message);
      else console.log(`✓ Section ${sec.section_key} created`);
    } else {
      console.log(`- Section ${sec.section_key} already exists`);
    }
  }

  console.log('\nDone!');
}

seed().catch(console.error);
