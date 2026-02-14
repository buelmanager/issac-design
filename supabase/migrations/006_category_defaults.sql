-- Add defaults column to product_categories for category-level default values
ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS defaults JSONB DEFAULT '{}';
