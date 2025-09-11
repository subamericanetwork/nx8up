import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncStatsRequest {
  accountId: string;
}

interface SocialStats {
  followers_count: number;
  following_count: number;
  posts_count: number;
  likes_count: number;
  views_count: number;
  engagement_rate: number;
  avg_likes_per_post: number;
  avg_comments_per_post: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { accountId }: SyncStatsRequest = await req.json();
    
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    // Get the social media account details with tokens (service role access)
    const { data: account, error: accountError } = await supabase
      .rpc('get_social_account_with_tokens', { account_id: accountId })
      .single();

    if (accountError || !account) {
      throw new Error('Social media account not found');
    }

    console.log(`Syncing stats for ${account.platform} account: @${account.username}`);

    let stats: SocialStats;

    // Platform-specific stat fetching
    switch (account.platform) {
      case 'youtube':
        stats = await fetchYouTubeStats(account);
        break;
      case 'instagram':
        stats = await fetchInstagramStats(account);
        break;
      case 'tiktok':
        stats = await fetchTikTokStats(account);
        break;
      case 'twitter':
        stats = await fetchTwitterStats(account);
        break;
      default:
        throw new Error(`Platform ${account.platform} not supported`);
    }

    // Insert new stats record
    const { error: statsError } = await supabase
      .from('social_media_stats')
      .insert({
        account_id: accountId,
        ...stats
      });

    if (statsError) {
      console.error('Error inserting stats:', statsError);
      throw statsError;
    }

    // Update the last synced timestamp
    const { error: updateError } = await supabase
      .from('social_media_accounts')
      .update({ 
        last_synced_at: new Date().toISOString() 
      })
      .eq('id', accountId);

    if (updateError) {
      console.error('Error updating sync timestamp:', updateError);
      throw updateError;
    }

    console.log(`Successfully synced stats for ${account.platform} account`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Stats synced successfully',
        stats 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error('Error in sync-social-stats function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to sync social media stats' 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

// Platform-specific stat fetching functions
// These are placeholder implementations - in production, you'd integrate with actual APIs

async function fetchYouTubeStats(account: any): Promise<SocialStats> {
  // TODO: Integrate with YouTube Data API v3
  // For now, return mock data that simulates realistic growth
  console.log(`Fetching YouTube stats for ${account.username}`);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate mock stats with some randomness to simulate real data
  const baseFollowers = 15000 + Math.floor(Math.random() * 5000);
  const basePosts = 150 + Math.floor(Math.random() * 50);
  const baseLikes = baseFollowers * 0.05 * basePosts;
  const baseViews = baseLikes * 20;
  
  return {
    followers_count: baseFollowers,
    following_count: 250 + Math.floor(Math.random() * 100),
    posts_count: basePosts,
    likes_count: Math.floor(baseLikes),
    views_count: Math.floor(baseViews),
    engagement_rate: 3.5 + Math.random() * 2,
    avg_likes_per_post: Math.floor(baseLikes / basePosts),
    avg_comments_per_post: Math.floor((baseLikes / basePosts) * 0.1)
  };
}

async function fetchInstagramStats(account: any): Promise<SocialStats> {
  // TODO: Integrate with Instagram Basic Display API
  console.log(`Fetching Instagram stats for ${account.username}`);
  
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const baseFollowers = 8000 + Math.floor(Math.random() * 3000);
  const basePosts = 200 + Math.floor(Math.random() * 100);
  const baseLikes = baseFollowers * 0.08 * basePosts;
  
  return {
    followers_count: baseFollowers,
    following_count: 500 + Math.floor(Math.random() * 200),
    posts_count: basePosts,
    likes_count: Math.floor(baseLikes),
    views_count: Math.floor(baseLikes * 15),
    engagement_rate: 4.2 + Math.random() * 2.5,
    avg_likes_per_post: Math.floor(baseLikes / basePosts),
    avg_comments_per_post: Math.floor((baseLikes / basePosts) * 0.12)
  };
}

async function fetchTikTokStats(account: any): Promise<SocialStats> {
  // TODO: Integrate with TikTok API for Business
  console.log(`Fetching TikTok stats for ${account.username}`);
  
  await new Promise(resolve => setTimeout(resolve, 900));
  
  const baseFollowers = 25000 + Math.floor(Math.random() * 10000);
  const basePosts = 80 + Math.floor(Math.random() * 40);
  const baseLikes = baseFollowers * 0.12 * basePosts;
  const baseViews = baseLikes * 50;
  
  return {
    followers_count: baseFollowers,
    following_count: 150 + Math.floor(Math.random() * 50),
    posts_count: basePosts,
    likes_count: Math.floor(baseLikes),
    views_count: Math.floor(baseViews),
    engagement_rate: 6.8 + Math.random() * 3,
    avg_likes_per_post: Math.floor(baseLikes / basePosts),
    avg_comments_per_post: Math.floor((baseLikes / basePosts) * 0.08)
  };
}

async function fetchTwitterStats(account: any): Promise<SocialStats> {
  // TODO: Integrate with Twitter API v2
  console.log(`Fetching Twitter stats for ${account.username}`);
  
  await new Promise(resolve => setTimeout(resolve, 700));
  
  const baseFollowers = 5000 + Math.floor(Math.random() * 2000);
  const basePosts = 500 + Math.floor(Math.random() * 300);
  const baseLikes = baseFollowers * 0.03 * basePosts;
  
  return {
    followers_count: baseFollowers,
    following_count: 800 + Math.floor(Math.random() * 400),
    posts_count: basePosts,
    likes_count: Math.floor(baseLikes),
    views_count: Math.floor(baseLikes * 8),
    engagement_rate: 2.1 + Math.random() * 1.5,
    avg_likes_per_post: Math.floor(baseLikes / basePosts),
    avg_comments_per_post: Math.floor((baseLikes / basePosts) * 0.05)
  };
}

serve(handler);