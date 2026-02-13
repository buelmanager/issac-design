import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface BlogFrontmatter {
  title: string;
  date: string;
  tags: string[];
  description: string;
  thumbnail?: string;
  heroImage?: {
    src: string;
    alt: string;
  };
}

function parseFrontmatter(content: string): { frontmatter: BlogFrontmatter; body: string } {
  const parts = content.split('---');
  if (parts.length < 3) {
    throw new Error('Invalid frontmatter format');
  }

  const frontmatterStr = parts[1];
  const body = parts.slice(2).join('---').trim();

  const frontmatter: BlogFrontmatter = {
    title: '',
    date: '',
    tags: [],
    description: '',
  };

  const lines = frontmatterStr.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;

    if (line.startsWith('title:')) {
      frontmatter.title = line.replace('title:', '').trim().replace(/^["']|["']$/g, '');
    } else if (line.startsWith('date:')) {
      frontmatter.date = line.replace('date:', '').trim().replace(/^["']|["']$/g, '');
    } else if (line.startsWith('description:')) {
      frontmatter.description = line.replace('description:', '').trim().replace(/^["']|["']$/g, '');
    } else if (line.startsWith('tags:')) {
      const tagsStr = line.replace('tags:', '').trim();
      const tagsMatch = tagsStr.match(/\[(.*?)\]/);
      if (tagsMatch) {
        frontmatter.tags = tagsMatch[1]
          .split(',')
          .map((t) => t.trim().replace(/^["']|["']$/g, ''));
      }
    } else if (line.startsWith('thumbnail:')) {
      frontmatter.thumbnail = line.replace('thumbnail:', '').trim().replace(/^["']|["']$/g, '');
    }
  }

  return { frontmatter, body };
}

async function migrateBlog() {
  try {
    const blogDir = path.resolve(__dirname, '../src/content/blog');
    const files = readdirSync(blogDir).filter((f) => f.endsWith('.md'));

    const blogPosts = [];

    for (const file of files) {
      const filePath = path.join(blogDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);

      const slug = file.replace('.md', '');

      blogPosts.push({
        slug,
        title: frontmatter.title,
        description: frontmatter.description,
        content: body,
        category: 'signage',
        tags: frontmatter.tags,
        image_url: frontmatter.thumbnail || null,
        author: 'issac.design',
        is_published: true,
        published_at: frontmatter.date,
        is_seed: true,
      });
    }

    const { error } = await supabase
      .from('blog_posts')
      .upsert(blogPosts, { onConflict: 'slug' });

    if (error) {
      console.error('Error inserting blog posts:', error);
      process.exit(1);
    }

    console.log(`✓ Successfully migrated ${blogPosts.length} blog posts`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateBlog();
