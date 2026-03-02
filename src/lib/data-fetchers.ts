import { supabase } from '../lib/supabase';
import type { Json } from '../types/database';
import productsJSON from '../data/products.json';
import portfolioJSON from '../data/portfolio.json';
import faqJSON from '../data/shop-faq.json';

// ─── Product types (matches JSON shape) ───────────────────────────

interface ProductJSON {
  id: string;
  slug: string;
  name: string;
  category: string;
  categoryName: string;
  price: string;
  priceRange: string;
  thumbnail: string;
  images: string[];
  description: string;
  fullDesc: string;
  features: string[];
  specs: Record<string, string>;
  productionTime: string;
  includedServices: string[];
  tags: string[];
  materialImages: Record<string, string>;
  lightingImages: Record<string, string>;
  options: {
    sizes: Array<{ label: string; priceModifier: string }>;
    materials: Array<{ label: string; description: string }>;
    finishes: Array<{ label: string; colorHex: string }>;
    lightingTypes: Array<{ label: string; description: string }>;
  };
  productionSteps: Array<{ step: number; duration: string; description: string }>;
  popularity: number;
  isNew: boolean;
  isFeatured: boolean;
  relatedProducts: string[];
  installationGallery: Array<{ before: string; after: string; location: string }>;
  isFixedPrice: boolean;
  fixedPrice: number | null;
}

interface CategoryJSON {
  id: string;
  name: string;
  description: string;
  icon: string;
}

// ─── Portfolio types ──────────────────────────────────────────────

interface PortfolioJSON {
  id: string;
  title: string;
  category: string;
  description: string;
  client: string;
  location: string;
  completedDate: string;
  images: {
    before: string;
    after: string;
    process: string;
  };
  productUsed: string;
  testimonial: string;
}

// ─── FAQ types ────────────────────────────────────────────────────

interface FaqCategoryJSON {
  id: string;
  name: string;
  icon: string;
}

interface FaqJSON {
  id: string;
  category: string;
  categoryName: string;
  question: string;
  answer: string;
}

// ─── Price utilities ──────────────────────────────────────────────

export function formatPrice(price: number): string {
  return price.toLocaleString('ko-KR') + '원';
}

// ─── Typed fallback helpers (JSON.parse breaks narrow inferred union types) ──

type ProductsResult = { products: ProductJSON[]; categories: CategoryJSON[] };
type PortfolioResult = { portfolioItems: PortfolioJSON[] };
type FaqResult = { faqCategories: FaqCategoryJSON[]; faqs: FaqJSON[] };

function fallbackProducts(): ProductsResult {
  return JSON.parse(JSON.stringify(productsJSON)) as ProductsResult;
}

function fallbackPortfolio(): PortfolioResult {
  return JSON.parse(JSON.stringify(portfolioJSON)) as PortfolioResult;
}

function fallbackFaq(): FaqResult {
  return JSON.parse(JSON.stringify(faqJSON)) as FaqResult;
}

// ─── Json → typed helpers ─────────────────────────────────────────

function asStringArray(json: Json): string[] {
  if (Array.isArray(json)) return json.filter((v): v is string => typeof v === 'string');
  return [];
}

function asStringRecord(json: Json): Record<string, string> {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === 'string') result[k] = v;
    }
    return result;
  }
  return {};
}

// ─── getProducts ──────────────────────────────────────────────────

export async function getProducts(): Promise<{
  products: ProductJSON[];
  categories: CategoryJSON[];
}> {
  try {
    const { data: catRows, error: catError } = await supabase
      .from('product_categories')
      .select('*')
      .eq('is_visible', true)
      .order('order_index');

    if (catError || !catRows || catRows.length === 0) {
      console.warn('[Fallback] product_categories query failed or empty, using JSON');
      return fallbackProducts();
    }

    const categoryMap = new Map(catRows.map((c) => [c.id, c]));

    const categories: CategoryJSON[] = catRows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      icon: '',
    }));

    const { data: prodRows, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('is_visible', true)
      .order('popularity', { ascending: false });

    if (prodError || !prodRows || prodRows.length === 0) {
      console.warn('[Fallback] products query failed or empty, using JSON');
      return fallbackProducts();
    }

    const products: ProductJSON[] = prodRows.map((row) => {
      const cat = row.category_id ? categoryMap.get(row.category_id) : undefined;
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        category: row.category_id ?? '',
        categoryName: cat?.name ?? '',
        price: row.price,
        priceRange: row.price_range ?? '',
        thumbnail: row.thumbnail,
        images: asStringArray(row.images),
        description: row.description ?? '',
        fullDesc: row.full_description ?? '',
        features: asStringArray(row.features),
        specs: asStringRecord(row.specs),
        productionTime: row.production_time ?? '',
        includedServices: asStringArray(row.included_services),
        tags: asStringArray(row.tags),
        materialImages: asStringRecord(row.material_images),
        lightingImages: asStringRecord(row.lighting_images),
        options: row.options as ProductJSON['options'],
        productionSteps: row.production_steps as ProductJSON['productionSteps'],
        popularity: row.popularity,
        isNew: row.is_new,
        isFeatured: row.is_featured,
        relatedProducts: asStringArray(row.related_product_ids),
        installationGallery: row.installation_gallery as ProductJSON['installationGallery'],
        isFixedPrice: row.is_fixed_price ?? false,
        fixedPrice: typeof row.fixed_price === 'number' ? row.fixed_price : null,
      };
    });

    return { products, categories };
  } catch (err) {
    console.warn('[Fallback] getProducts error, using JSON:', err);
    return fallbackProducts();
  }
}

// ─── getPortfolioItems ────────────────────────────────────────────

export async function getPortfolioItems(): Promise<{
  portfolioItems: PortfolioJSON[];
}> {
  try {
    const { data: rows, error } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('is_visible', true)
      .order('order_index');

    if (error || !rows || rows.length === 0) {
      console.warn('[Fallback] portfolio_items query failed or empty, using JSON');
      return fallbackPortfolio();
    }

    const portfolioItems: PortfolioJSON[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      description: row.description ?? '',
      client: row.client_name ?? '',
      location: row.location ?? '',
      completedDate: row.completed_date ?? '',
      images: {
        before: row.image_before ?? '',
        after: row.image_after ?? '',
        process: row.image_process ?? '',
      },
      productUsed: row.product_used ?? '',
      testimonial: row.testimonial ?? '',
    }));

    return { portfolioItems };
  } catch (err) {
    console.warn('[Fallback] getPortfolioItems error, using JSON:', err);
    return fallbackPortfolio();
  }
}

// ─── getFaqData ───────────────────────────────────────────────────

export async function getFaqData(): Promise<{
  faqCategories: FaqCategoryJSON[];
  faqs: FaqJSON[];
}> {
  try {
    const { data: catRows, error: catError } = await supabase
      .from('faq_categories')
      .select('*')
      .order('order_index');

    if (catError || !catRows || catRows.length === 0) {
      console.warn('[Fallback] faq_categories query failed or empty, using JSON');
      return fallbackFaq();
    }

    const catMap = new Map(catRows.map((c) => [c.id, c]));

    const faqCategories: FaqCategoryJSON[] = catRows.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon_key ?? '',
    }));

    const { data: faqRows, error: faqError } = await supabase
      .from('faq_items')
      .select('*')
      .eq('is_visible', true)
      .order('order_index');

    if (faqError || !faqRows || faqRows.length === 0) {
      console.warn('[Fallback] faq_items query failed or empty, using JSON');
      return fallbackFaq();
    }

    const faqs: FaqJSON[] = faqRows.map((row) => {
      const cat = row.category_id ? catMap.get(row.category_id) : undefined;
      return {
        id: row.id,
        category: row.category_id ?? '',
        categoryName: cat?.name ?? '',
        question: row.question,
        answer: row.answer,
      };
    });

    return { faqCategories, faqs };
  } catch (err) {
    console.warn('[Fallback] getFaqData error, using JSON:', err);
    return fallbackFaq();
  }
}
