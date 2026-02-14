import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function readJson(relativePath) {
  const filePath = path.resolve(__dirname, '..', relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function seedProducts() {
  const data = readJson('src/data/products.json');
  const products = data.products;

  const mapped = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    category_id: p.category,
    price: p.price,
    price_range: p.priceRange,
    thumbnail: p.thumbnail,
    images: p.images,
    description: p.description,
    full_description: p.fullDesc,
    features: p.features,
    specs: p.specs,
    production_time: p.productionTime,
    included_services: p.includedServices,
    tags: p.tags,
    material_images: p.materialImages || {},
    lighting_images: p.lightingImages || {},
    options: p.options,
    production_steps: p.productionSteps,
    popularity: p.popularity,
    is_new: p.isNew,
    is_featured: p.isFeatured,
    related_product_ids: p.relatedProducts,
    installation_gallery: p.installationGallery,
    is_seed: true,
    is_visible: true,
  }));

  const { error } = await supabase
    .from('products')
    .upsert(mapped, { onConflict: 'id' });

  if (error) {
    console.error('products error:', error);
    process.exit(1);
  }
  console.log(`  products: ${mapped.length}건 삽입 완료`);
}

async function seedPortfolio() {
  const data = readJson('src/data/portfolio.json');
  const items = data.portfolioItems;

  const mapped = items.map((item, index) => {
    const [year, month] = item.completedDate.split('-');
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      description: item.description,
      client_name: item.client,
      location: item.location,
      completed_date: `${year}-${month}-01`,
      image_before: item.images.before,
      image_after: item.images.after,
      image_process: item.images.process,
      product_used: item.productUsed,
      testimonial: item.testimonial,
      order_index: index,
      is_seed: true,
      is_visible: true,
    };
  });

  const { error } = await supabase
    .from('portfolio_items')
    .upsert(mapped, { onConflict: 'id' });

  if (error) {
    console.error('portfolio_items error:', error);
    process.exit(1);
  }
  console.log(`  portfolio_items: ${mapped.length}건 삽입 완료`);
}

async function seedFaq() {
  const data = readJson('src/data/shop-faq.json');
  const categories = data.faqCategories;
  const faqs = data.faqs;

  // 1) faq_categories
  const mappedCats = categories.map((cat, index) => ({
    id: cat.id,
    name: cat.name,
    icon_key: cat.icon,
    order_index: index,
    is_seed: true,
  }));

  const { error: catError } = await supabase
    .from('faq_categories')
    .upsert(mappedCats, { onConflict: 'id' });

  if (catError) {
    console.error('faq_categories error:', catError);
    process.exit(1);
  }
  console.log(`  faq_categories: ${mappedCats.length}건 삽입 완료`);

  // 2) faq_items
  const mappedFaqs = faqs.map((faq) => {
    const sameCategory = faqs.filter((f) => f.category === faq.category);
    const orderInCategory = sameCategory.indexOf(faq);
    return {
      id: faq.id,
      category_id: faq.category,
      question: faq.question,
      answer: faq.answer,
      order_index: orderInCategory,
      is_seed: true,
      is_visible: true,
    };
  });

  const { error: faqError } = await supabase
    .from('faq_items')
    .upsert(mappedFaqs, { onConflict: 'id' });

  if (faqError) {
    console.error('faq_items error:', faqError);
    process.exit(1);
  }
  console.log(`  faq_items: ${mappedFaqs.length}건 삽입 완료`);
}

async function main() {
  console.log('=== Supabase 시드 데이터 삽입 시작 ===\n');

  await seedProducts();
  await seedPortfolio();
  await seedFaq();

  // Verify row counts
  console.log('\n=== 삽입 결과 확인 ===');
  const tables = ['products', 'portfolio_items', 'faq_categories', 'faq_items'];
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ${table}: 조회 오류 - ${error.message}`);
    } else {
      console.log(`  ${table}: ${count}건`);
    }
  }

  console.log('\n=== 시드 데이터 삽입 완료 ===');
}

main();
