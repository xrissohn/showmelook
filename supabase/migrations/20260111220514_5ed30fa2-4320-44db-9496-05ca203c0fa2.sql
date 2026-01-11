-- Create liked_products table for saving favorite products
CREATE TABLE public.liked_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  product_brand TEXT,
  product_price INTEGER NOT NULL,
  product_image_url TEXT,
  product_url TEXT NOT NULL,
  product_category TEXT,
  style_tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Enable Row Level Security
ALTER TABLE public.liked_products ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own liked products" 
ON public.liked_products 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own liked products" 
ON public.liked_products 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own liked products" 
ON public.liked_products 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_liked_products_user_id ON public.liked_products(user_id);
CREATE INDEX idx_liked_products_created_at ON public.liked_products(created_at DESC);