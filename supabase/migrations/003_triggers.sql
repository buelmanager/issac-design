CREATE TABLE seed_data_backup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  seed_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(table_name, record_id)
);

ALTER TABLE seed_data_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all ON seed_data_backup FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM admin_users));

CREATE OR REPLACE FUNCTION restore_seed_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  backup_record JSONB;
BEGIN
  SELECT seed_data INTO backup_record
  FROM seed_data_backup
  WHERE table_name = TG_TABLE_NAME
    AND record_id = OLD.id::TEXT;

  IF backup_record IS NOT NULL THEN
    EXECUTE format(
      'INSERT INTO %I SELECT * FROM jsonb_populate_record(null::%I, $1)',
      TG_TABLE_NAME, TG_TABLE_NAME
    ) USING backup_record || jsonb_build_object('is_seed', true);
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_as_user_data()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_seed IS DISTINCT FROM OLD.is_seed THEN
    RETURN NEW;
  END IF;

  NEW.is_seed := false;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_restore_seed_hero_slides
  AFTER DELETE ON hero_slides
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_hero_slides
  BEFORE UPDATE ON hero_slides
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_service_items
  AFTER DELETE ON service_items
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_service_items
  BEFORE UPDATE ON service_items
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_signage_types
  AFTER DELETE ON signage_types
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_signage_types
  BEFORE UPDATE ON signage_types
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_client_projects
  AFTER DELETE ON client_projects
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_client_projects
  BEFORE UPDATE ON client_projects
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_project_filter_tabs
  AFTER DELETE ON project_filter_tabs
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_project_filter_tabs
  BEFORE UPDATE ON project_filter_tabs
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_landing_sections
  AFTER DELETE ON landing_sections
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_landing_sections
  BEFORE UPDATE ON landing_sections
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_landing_faqs
  AFTER DELETE ON landing_faqs
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_landing_faqs
  BEFORE UPDATE ON landing_faqs
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_trust_indicators
  AFTER DELETE ON trust_indicators
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_trust_indicators
  BEFORE UPDATE ON trust_indicators
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_client_logos
  AFTER DELETE ON client_logos
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_client_logos
  BEFORE UPDATE ON client_logos
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_about_sections
  AFTER DELETE ON about_sections
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_about_sections
  BEFORE UPDATE ON about_sections
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_blog_posts
  AFTER DELETE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_blog_posts
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_simulator_config
  AFTER DELETE ON simulator_config
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_simulator_config
  BEFORE UPDATE ON simulator_config
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_page_contents
  AFTER DELETE ON page_contents
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_page_contents
  BEFORE UPDATE ON page_contents
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_navigation_items
  AFTER DELETE ON navigation_items
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_navigation_items
  BEFORE UPDATE ON navigation_items
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_product_categories
  AFTER DELETE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_product_categories
  BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_products
  AFTER DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_products
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_portfolio_items
  AFTER DELETE ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_portfolio_items
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_faq_categories
  AFTER DELETE ON faq_categories
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_faq_categories
  BEFORE UPDATE ON faq_categories
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_faq_items
  AFTER DELETE ON faq_items
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_faq_items
  BEFORE UPDATE ON faq_items
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_inquiry_types
  AFTER DELETE ON inquiry_types
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_inquiry_types
  BEFORE UPDATE ON inquiry_types
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();

CREATE TRIGGER trigger_restore_seed_site_config
  AFTER DELETE ON site_config
  FOR EACH ROW EXECUTE FUNCTION restore_seed_on_delete();
CREATE TRIGGER trigger_mark_user_data_site_config
  BEFORE UPDATE ON site_config
  FOR EACH ROW EXECUTE FUNCTION mark_as_user_data();
