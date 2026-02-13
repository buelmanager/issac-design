CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'admin',
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE site_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  value_type TEXT DEFAULT 'text',
  category TEXT NOT NULL,
  description TEXT,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

CREATE TABLE landing_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT UNIQUE NOT NULL,
  title TEXT,
  subtitle TEXT,
  description TEXT,
  eyebrow TEXT,
  is_visible BOOLEAN DEFAULT true,
  order_index INT,
  extra_data JSONB DEFAULT '{}',
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

CREATE TABLE hero_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page TEXT NOT NULL,
  slide_index INT,
  eyebrow TEXT,
  title_line1 TEXT,
  title_line2 TEXT,
  subtitle TEXT,
  description TEXT,
  cta_primary_text TEXT,
  cta_primary_link TEXT,
  cta_secondary_text TEXT,
  cta_secondary_link TEXT,
  video_url TEXT,
  video_webm_url TEXT,
  poster_url TEXT,
  is_visible BOOLEAN DEFAULT true,
  order_index INT,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(page, slide_index)
);

CREATE TABLE service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon_key TEXT,
  icon_svg TEXT,
  title TEXT,
  description TEXT,
  is_visible BOOLEAN DEFAULT true,
  order_index INT,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE signage_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number_label TEXT,
  title TEXT,
  description TEXT,
  link TEXT,
  image_url TEXT,
  icon_key TEXT,
  is_visible BOOLEAN DEFAULT true,
  order_index INT,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE client_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  name TEXT,
  project_type TEXT,
  image_url TEXT,
  is_visible BOOLEAN DEFAULT true,
  order_index INT,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE project_filter_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_key TEXT UNIQUE NOT NULL,
  label TEXT,
  order_index INT,
  is_visible BOOLEAN DEFAULT true,
  is_seed BOOLEAN DEFAULT false
);

CREATE TABLE product_categories (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  order_index INT,
  is_visible BOOLEAN DEFAULT true,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT,
  category_id TEXT REFERENCES product_categories(id),
  price TEXT DEFAULT '문의',
  price_range TEXT,
  thumbnail TEXT,
  images JSONB DEFAULT '[]',
  description TEXT,
  full_description TEXT,
  features JSONB DEFAULT '[]',
  specs JSONB DEFAULT '{}',
  production_time TEXT,
  included_services JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  material_images JSONB DEFAULT '{}',
  lighting_images JSONB DEFAULT '{}',
  options JSONB DEFAULT '{}',
  production_steps JSONB DEFAULT '[]',
  installation_gallery JSONB DEFAULT '[]',
  popularity INT DEFAULT 0,
  is_new BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  related_product_ids JSONB DEFAULT '[]',
  is_visible BOOLEAN DEFAULT true,
  is_seed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_popularity ON products(popularity DESC);

CREATE TABLE portfolio_items (
  id TEXT PRIMARY KEY,
  title TEXT,
  category TEXT,
  description TEXT,
  client_name TEXT,
  location TEXT,
  completed_date DATE,
  image_before TEXT,
  image_after TEXT,
  image_process TEXT,
  product_used TEXT,
  testimonial TEXT,
  is_visible BOOLEAN DEFAULT true,
  order_index INT,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE faq_categories (
  id TEXT PRIMARY KEY,
  name TEXT,
  icon_key TEXT,
  order_index INT,
  is_seed BOOLEAN DEFAULT false
);

CREATE TABLE faq_items (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES faq_categories(id),
  question TEXT,
  answer TEXT,
  is_visible BOOLEAN DEFAULT true,
  order_index INT,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE landing_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT,
  answer TEXT,
  is_visible BOOLEAN DEFAULT true,
  order_index INT,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trust_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number_text TEXT,
  label TEXT,
  description TEXT,
  order_index INT,
  is_visible BOOLEAN DEFAULT true,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE client_logos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  logo_url TEXT,
  website_url TEXT,
  order_index INT,
  is_visible BOOLEAN DEFAULT true,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE about_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT UNIQUE NOT NULL,
  content JSONB,
  is_visible BOOLEAN DEFAULT true,
  order_index INT,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  content TEXT,
  category TEXT,
  tags JSONB DEFAULT '[]',
  image_url TEXT,
  image_alt TEXT,
  author TEXT DEFAULT 'issac.design',
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  is_seed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT,
  email TEXT,
  phone TEXT,
  business_name TEXT,
  request_type TEXT,
  products JSONB DEFAULT '[]',
  message TEXT,
  attachments JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quote_requests_status ON quote_requests(status);
CREATE INDEX idx_quote_requests_created ON quote_requests(created_at DESC);

CREATE TABLE contact_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  phone TEXT,
  inquiry_type TEXT,
  message TEXT,
  status TEXT DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE simulator_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE page_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL,
  content_key TEXT NOT NULL,
  value TEXT,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(page_key, content_key)
);

CREATE TABLE navigation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nav_type TEXT,
  label TEXT,
  href TEXT,
  order_index INT,
  is_visible BOOLEAN DEFAULT true,
  icon_key TEXT,
  is_seed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inquiry_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT,
  value TEXT,
  order_index INT,
  is_visible BOOLEAN DEFAULT true,
  is_seed BOOLEAN DEFAULT false
);
