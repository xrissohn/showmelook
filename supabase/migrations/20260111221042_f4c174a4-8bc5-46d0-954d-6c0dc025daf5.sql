-- Drop the existing foreign key constraint on cart_items
ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_product_id_fkey;

-- Add a new column to store the product source (cache or products)
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS product_source TEXT DEFAULT 'cache';

-- Add columns to store product info directly (for products from cache that may not exist in products table)
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS product_brand TEXT;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS product_price INTEGER;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS product_image_url TEXT;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS product_url TEXT;