-- Insert demo social media accounts for testing
-- Note: This will only work if there are existing creator profiles

-- First, let's create some sample social accounts for the first creator profile we find
DO $$
DECLARE
    creator_profile_id UUID;
BEGIN
    -- Get the first creator profile
    SELECT id INTO creator_profile_id 
    FROM public.profiles 
    WHERE user_type = 'creator' 
    LIMIT 1;
    
    -- Only proceed if we found a creator profile
    IF creator_profile_id IS NOT NULL THEN
        -- Insert demo social media accounts
        INSERT INTO public.social_media_accounts (
            creator_id, platform, platform_user_id, username, display_name, 
            profile_image_url, is_active, connected_at, last_synced_at
        ) VALUES
            (creator_profile_id, 'youtube', 'UC123456789', 'creativecreator', 'Creative Creator', 
             'https://example.com/avatar1.jpg', true, now(), now() - interval '1 hour'),
            (creator_profile_id, 'instagram', 'ig_123456789', 'creative_creator', 'Creative Creator', 
             'https://example.com/avatar2.jpg', true, now(), now() - interval '2 hours'),
            (creator_profile_id, 'tiktok', 'tt_123456789', 'creativecreator', 'Creative Creator', 
             'https://example.com/avatar3.jpg', true, now(), now() - interval '3 hours')
        ON CONFLICT (creator_id, platform, platform_user_id) DO NOTHING;
        
        -- Insert demo statistics for these accounts
        INSERT INTO public.social_media_stats (
            account_id, followers_count, following_count, posts_count, 
            likes_count, views_count, engagement_rate, avg_likes_per_post, 
            avg_comments_per_post, recorded_at
        )
        SELECT 
            sma.id,
            CASE 
                WHEN sma.platform = 'youtube' THEN 18500
                WHEN sma.platform = 'instagram' THEN 9200
                WHEN sma.platform = 'tiktok' THEN 32000
                ELSE 6800
            END,
            CASE 
                WHEN sma.platform = 'youtube' THEN 320
                WHEN sma.platform = 'instagram' THEN 680
                WHEN sma.platform = 'tiktok' THEN 180
                ELSE 920
            END,
            CASE 
                WHEN sma.platform = 'youtube' THEN 185
                WHEN sma.platform = 'instagram' THEN 280
                WHEN sma.platform = 'tiktok' THEN 95
                ELSE 650
            END,
            CASE 
                WHEN sma.platform = 'youtube' THEN 45000
                WHEN sma.platform = 'instagram' THEN 28000
                WHEN sma.platform = 'tiktok' THEN 85000
                ELSE 12000
            END,
            CASE 
                WHEN sma.platform = 'youtube' THEN 850000
                WHEN sma.platform = 'instagram' THEN 420000
                WHEN sma.platform = 'tiktok' THEN 1200000
                ELSE 95000
            END,
            CASE 
                WHEN sma.platform = 'youtube' THEN 4.2
                WHEN sma.platform = 'instagram' THEN 5.8
                WHEN sma.platform = 'tiktok' THEN 7.5
                ELSE 2.8
            END,
            CASE 
                WHEN sma.platform = 'youtube' THEN 243
                WHEN sma.platform = 'instagram' THEN 100
                WHEN sma.platform = 'tiktok' THEN 895
                ELSE 18
            END,
            CASE 
                WHEN sma.platform = 'youtube' THEN 28
                WHEN sma.platform = 'instagram' THEN 12
                WHEN sma.platform = 'tiktok' THEN 68
                ELSE 3
            END,
            now()
        FROM public.social_media_accounts sma
        WHERE sma.creator_id = creator_profile_id;
        
        RAISE NOTICE 'Demo social media accounts created for creator profile: %', creator_profile_id;
    ELSE
        RAISE NOTICE 'No creator profiles found. Please create a creator account first.';
    END IF;
END $$;