-- Create table for social media connections
CREATE TABLE public.social_media_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'twitter')),
  platform_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  profile_image_url TEXT,
  access_token TEXT, -- encrypted token for API access
  refresh_token TEXT, -- for refreshing expired tokens
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(creator_id, platform, platform_user_id)
);

-- Create table for social media statistics
CREATE TABLE public.social_media_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.social_media_accounts(id) ON DELETE CASCADE,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  views_count BIGINT DEFAULT 0,
  engagement_rate DECIMAL(5,2), -- percentage
  avg_likes_per_post INTEGER DEFAULT 0,
  avg_comments_per_post INTEGER DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_media_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_media_accounts
CREATE POLICY "Creators can manage their own social accounts" ON public.social_media_accounts
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE id = creator_id
    )
  );

-- RLS Policies for social_media_stats  
CREATE POLICY "Creators can view their own social stats" ON public.social_media_stats
  FOR SELECT USING (
    auth.uid() IN (
      SELECT sma.creator_id FROM public.social_media_accounts sma WHERE sma.id = account_id
    )
  );

CREATE POLICY "System can insert social stats" ON public.social_media_stats
  FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_social_accounts_creator_id ON public.social_media_accounts(creator_id);
CREATE INDEX idx_social_accounts_platform ON public.social_media_accounts(platform);
CREATE INDEX idx_social_stats_account_id ON public.social_media_stats(account_id);
CREATE INDEX idx_social_stats_recorded_at ON public.social_media_stats(recorded_at);

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_social_media_accounts_updated_at
  BEFORE UPDATE ON public.social_media_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();