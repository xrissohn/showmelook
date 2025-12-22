-- Create style_cache table for caching generated images
CREATE TABLE public.style_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  style_trend_id UUID REFERENCES public.style_trends(id) ON DELETE SET NULL,
  product_ids UUID[] NOT NULL DEFAULT '{}',
  image_url TEXT NOT NULL,
  use_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.style_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read cache (for efficiency)
CREATE POLICY "Anyone can view style cache"
ON public.style_cache FOR SELECT
USING (true);

-- Only backend can insert/update (service role)
CREATE POLICY "Service role can manage cache"
ON public.style_cache FOR ALL
USING (true)
WITH CHECK (true);

-- Create user_subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  daily_limit INTEGER NOT NULL DEFAULT 5,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view their own subscription"
ON public.user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own subscription (for initial creation)
CREATE POLICY "Users can create their own subscription"
ON public.user_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create daily_generation_usage table
CREATE TABLE public.daily_generation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  generation_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, usage_date)
);

-- Enable RLS
ALTER TABLE public.daily_generation_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view their own usage"
ON public.daily_generation_usage FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own usage
CREATE POLICY "Users can create their own usage"
ON public.daily_generation_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage
CREATE POLICY "Users can update their own usage"
ON public.daily_generation_usage FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for updated_at on user_subscriptions
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on daily_generation_usage
CREATE TRIGGER update_daily_generation_usage_updated_at
BEFORE UPDATE ON public.daily_generation_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();