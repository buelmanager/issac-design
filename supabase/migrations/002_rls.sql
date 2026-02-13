ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_filter_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_logos ENABLE ROW LEVEL SECURITY;
ALTER TABLE about_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_types ENABLE ROW LEVEL SECURITY;
-- seed_data_backup RLS moved to 003_triggers.sql (table created there)

-- SECURITY DEFINER function to check admin status (bypasses RLS, avoids infinite recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid());
$$;

-- admin_users: direct id match to avoid self-referencing recursion
CREATE POLICY admin_all ON admin_users FOR ALL TO authenticated
  USING (auth.uid() = id);

CREATE POLICY public_read ON site_config FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY admin_all ON site_config FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON landing_sections FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON landing_sections FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON hero_slides FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON hero_slides FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON service_items FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON service_items FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON signage_types FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON signage_types FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON client_projects FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON client_projects FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON project_filter_tabs FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON project_filter_tabs FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON product_categories FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON product_categories FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON products FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON products FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON portfolio_items FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON portfolio_items FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON faq_categories FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY admin_all ON faq_categories FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON faq_items FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON faq_items FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON landing_faqs FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON landing_faqs FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON trust_indicators FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON trust_indicators FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON client_logos FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON client_logos FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON about_sections FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON about_sections FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON blog_posts FOR SELECT TO anon, authenticated
  USING (is_published = true);
CREATE POLICY admin_all ON blog_posts FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_insert ON quote_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY admin_all ON quote_requests FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_insert ON contact_inquiries FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY admin_all ON contact_inquiries FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON simulator_config FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY admin_all ON simulator_config FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON page_contents FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY admin_all ON page_contents FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON navigation_items FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON navigation_items FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY public_read ON inquiry_types FOR SELECT TO anon, authenticated
  USING (is_visible = true);
CREATE POLICY admin_all ON inquiry_types FOR ALL TO authenticated
  USING (public.is_admin());
