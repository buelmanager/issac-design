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

interface FaqCategory {
  id: string;
  name: string;
  icon: string;
}

interface FaqItem {
  id: string;
  category: string;
  categoryName: string;
  question: string;
  answer: string;
}

async function migrateFaq() {
  try {
    const filePath = path.resolve(__dirname, '../src/data/shop-faq.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    const faqCategories: FaqCategory[] = data.faqCategories;
    const faqs: FaqItem[] = data.faqs;

    const mappedCategories = faqCategories.map((cat, index) => ({
      id: cat.id,
      name: cat.name,
      icon_key: cat.icon,
      order_index: index,
      is_seed: true,
    }));

    const { error: catError } = await supabase
      .from('faq_categories')
      .upsert(mappedCategories, { onConflict: 'id' });

    if (catError) {
      console.error('Error inserting FAQ categories:', catError);
      process.exit(1);
    }

    const mappedFaqs = faqs.map((faq, index) => {
      const categoryIndex = faqCategories.findIndex((c) => c.id === faq.category);
      const orderInCategory = faqs.filter((f) => f.category === faq.category).indexOf(faq);

      return {
        id: `faq-${faq.category}-${orderInCategory}`,
        category_id: faq.category,
        question: faq.question,
        answer: faq.answer,
        order_index: orderInCategory,
        is_seed: true,
      };
    });

    const { error: faqError } = await supabase
      .from('faq_items')
      .upsert(mappedFaqs, { onConflict: 'id' });

    if (faqError) {
      console.error('Error inserting FAQ items:', faqError);
      process.exit(1);
    }

    console.log(`✓ Successfully migrated ${mappedCategories.length} FAQ categories`);
    console.log(`✓ Successfully migrated ${mappedFaqs.length} FAQ items`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateFaq();
