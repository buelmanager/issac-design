import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface Product {
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
  options: Record<string, unknown>;
  productionSteps: Array<{ step: number; duration: string; description: string }>;
  popularity: number;
  isNew: boolean;
  isFeatured: boolean;
  relatedProducts: string[];
  installationGallery: Array<{ before: string; after: string; location: string }>;
}

async function migrateProducts() {
  try {
    const filePath = path.resolve(__dirname, '../src/data/products.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    const products: Product[] = data.products;

    const mappedProducts = products.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      category_id: product.category,
      price: product.price,
      price_range: product.priceRange,
      thumbnail: product.thumbnail,
      images: product.images,
      description: product.description,
      full_description: product.fullDesc,
      features: product.features,
      specs: product.specs,
      production_time: product.productionTime,
      included_services: product.includedServices,
      tags: product.tags,
      material_images: product.materialImages,
      lighting_images: product.lightingImages,
      options: product.options,
      production_steps: product.productionSteps,
      popularity: product.popularity,
      is_new: product.isNew,
      is_featured: product.isFeatured,
      related_product_ids: product.relatedProducts,
      installation_gallery: product.installationGallery,
      is_seed: true,
      is_visible: true,
    }));

    const { data: result, error } = await supabase
      .from('products')
      .upsert(mappedProducts, { onConflict: 'id' });

    if (error) {
      console.error('Error inserting products:', error);
      process.exit(1);
    }

    console.log(`✓ Successfully migrated ${mappedProducts.length} products`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateProducts();
