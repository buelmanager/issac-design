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

interface PortfolioItem {
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

function formatDate(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  return `${year}-${month}-01`;
}

async function migratePortfolio() {
  try {
    const filePath = path.resolve(__dirname, '../src/data/portfolio.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    const portfolioItems: PortfolioItem[] = data.portfolioItems;

    const mappedItems = portfolioItems.map((item, index) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      description: item.description,
      client_name: item.client,
      location: item.location,
      completed_date: formatDate(item.completedDate),
      image_before: item.images.before,
      image_after: item.images.after,
      image_process: item.images.process,
      product_used: item.productUsed,
      testimonial: item.testimonial,
      order_index: index,
      is_seed: true,
      is_visible: true,
    }));

    const { data: result, error } = await supabase
      .from('portfolio_items')
      .upsert(mappedItems, { onConflict: 'id' });

    if (error) {
      console.error('Error inserting portfolio items:', error);
      process.exit(1);
    }

    console.log(`✓ Successfully migrated ${mappedItems.length} portfolio items`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migratePortfolio();
