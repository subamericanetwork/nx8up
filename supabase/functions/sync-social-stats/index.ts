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
    console.log('=== SYNC SOCIAL STATS FUNCTION CALLED ===');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { accountId }: SyncStatsRequest = await req.json();
    console.log('Account ID received:', accountId);
    
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    console.log('Fetching social account with tokens...');
    // Get the social media account details directly with service role (bypass RPC security issues)
    const { data: accountData, error: accountError } = await supabase
      .from('social_media_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('is_active', true)
      .single();
    
    if (accountError || !accountData) {
      console.error('Failed to fetch social account:', accountError);
      throw new Error(`Social media account not found: ${accountError?.message}`);
    }
    
    const account = accountData; // Direct object, not array
    console.log('Social account found:', {
      id: account.id,
      platform: account.platform, 
      username: account.username,
      is_active: account.is_active
    });


    console.log(`Syncing stats for ${account.platform} account: @${account.username}`);

    let stats: SocialStats;

    // Platform-specific stat fetching
    console.log(`Calling platform-specific stats function for: ${account.platform}`);
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

    console.log('Stats fetched successfully:', stats);

    // Insert new stats record
    console.log('Inserting stats into database...');
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

    console.log('Stats inserted successfully');

    // Update the last synced timestamp
    console.log('Updating last synced timestamp...');
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
  console.log(`Fetching comprehensive YouTube stats for ${account.username}`);
  
  try {
    // Use the decryption function to get the actual access token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get decrypted tokens using secure function
    console.log('Getting secure social tokens...');
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('get_secure_social_tokens', { account_id: account.id });
    
    console.log('Token retrieval result:', { 
      success: !!tokenData, 
      error: tokenError?.message,
      hasTokenData: !!tokenData
    });
    
    if (tokenError) {
      console.error('Token retrieval error:', tokenError);
      throw new Error(`Could not retrieve access token: ${tokenError.message}`);
    }
    
    if (!tokenData || tokenData.length === 0) {
      throw new Error('No access token found for this account');
    }
    
    const accessToken = tokenData[0]?.access_token;
    if (!accessToken || accessToken.trim() === '') {
      throw new Error('Access token is empty after decryption');
    }
    
    console.log('Successfully retrieved decrypted access token for YouTube API');
    
    // Get channel information with comprehensive stats
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings,contentDetails&mine=true`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!channelResponse.ok) {
      const errorText = await channelResponse.text();
      console.error('YouTube API channel error:', {
        status: channelResponse.status,
        statusText: channelResponse.statusText,
        error: errorText
      });
      throw new Error(`YouTube API error: ${channelResponse.status} ${channelResponse.statusText} - ${errorText}`);
    }
    
    const channelData = await channelResponse.json();
    console.log('YouTube channel data received for:', channelData.items?.[0]?.snippet?.title);
    
    if (!channelData.items || channelData.items.length === 0) {
      throw new Error('No YouTube channel found for this account');
    }
    
    const channel = channelData.items[0];
    const stats = channel.statistics;
    const channelId = channel.id;
    
    console.log('Channel stats from API:', stats);
    
    // Get recent videos for better engagement metrics (last 50 videos)
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    let totalVideos = parseInt(stats.videoCount || '0');
    let totalViews = parseInt(stats.viewCount || '0');
    let totalLikes = 0;
    let totalComments = 0;
    let recentVideoEngagement = 0;
    
    if (videosResponse.ok) {
      const videosData = await videosResponse.json();
      console.log(`Found ${videosData.items?.length || 0} recent videos`);
      
      // Get statistics for recent videos to calculate accurate engagement
      if (videosData.items && videosData.items.length > 0) {
        const videoIds = videosData.items.map((item: any) => item.id.videoId).join(',');
        
        const videoStatsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        );
        
        if (videoStatsResponse.ok) {
          const videoStatsData = await videoStatsResponse.json();
          console.log(`Got detailed stats for ${videoStatsData.items?.length || 0} videos`);
          
          // Calculate engagement from recent videos
          let recentLikes = 0;
          let recentComments = 0;
          let recentViews = 0;
          
          videoStatsData.items?.forEach((video: any) => {
            const videoStats = video.statistics;
            recentLikes += parseInt(videoStats?.likeCount || '0');
            recentComments += parseInt(videoStats?.commentCount || '0');
            recentViews += parseInt(videoStats?.viewCount || '0');
          });
          
          // Use recent video engagement for more accurate metrics
          totalLikes = recentLikes;
          totalComments = recentComments;
          
          // Calculate engagement rate based on recent performance
          // (likes + comments) / views for recent videos * 100
          recentVideoEngagement = recentViews > 0 ? 
            ((recentLikes + recentComments) / recentViews) * 100 : 0;
            
          console.log('Recent video engagement metrics:', {
            videos: videoStatsData.items?.length,
            likes: recentLikes,
            comments: recentComments,
            views: recentViews,
            engagementRate: recentVideoEngagement
          });
        }
      }
    }
    
    // Try to get YouTube Analytics data for better metrics (if scope available)
    let analyticsEngagement = 0;
    try {
      // Get last 30 days analytics if available
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const analyticsResponse = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&startDate=${startDate}&endDate=${endDate}&metrics=views%2Clikes%2Ccomments%2CaverageViewDuration%2CsubscribersGained&dimensions=day`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );
      
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        console.log('YouTube Analytics data available:', !!analyticsData.rows);
        
        if (analyticsData.rows && analyticsData.rows.length > 0) {
          // Calculate 30-day engagement from analytics
          let period30DayViews = 0;
          let period30DayLikes = 0;
          let period30DayComments = 0;
          
          analyticsData.rows.forEach((row: any[]) => {
            period30DayViews += row[1] || 0;  // views
            period30DayLikes += row[2] || 0;  // likes
            period30DayComments += row[3] || 0;  // comments
          });
          
          analyticsEngagement = period30DayViews > 0 ? 
            ((period30DayLikes + period30DayComments) / period30DayViews) * 100 : 0;
          
          console.log('30-day analytics engagement:', analyticsEngagement);
        }
      }
    } catch (analyticsError) {
      console.log('YouTube Analytics not available (may need additional permissions):', analyticsError);
    }
    
    const subscriberCount = parseInt(stats.subscriberCount || '0');
    const avgLikesPerPost = totalVideos > 0 ? Math.floor(totalLikes / Math.min(50, totalVideos)) : 0;
    const avgCommentsPerPost = totalVideos > 0 ? Math.floor(totalComments / Math.min(50, totalVideos)) : 0;
    
    // Use the best available engagement rate (prioritize analytics > recent videos > fallback)
    let finalEngagementRate = 0;
    if (analyticsEngagement > 0) {
      finalEngagementRate = analyticsEngagement;
      console.log('Using YouTube Analytics engagement rate:', finalEngagementRate);
    } else if (recentVideoEngagement > 0) {
      finalEngagementRate = recentVideoEngagement;
      console.log('Using recent video engagement rate:', finalEngagementRate);
    } else if (subscriberCount > 0) {
      // Fallback: total engagement vs subscribers
      finalEngagementRate = ((totalLikes + totalComments) / subscriberCount) * 100;
      console.log('Using fallback engagement calculation:', finalEngagementRate);
    }
    
    
    console.log(`Successfully fetched comprehensive YouTube stats for ${account.username}:`, {
      subscribers: subscriberCount,
      videos: totalVideos,
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      engagement: finalEngagementRate,
      avgLikesPerVideo: avgLikesPerPost,
      avgCommentsPerVideo: avgCommentsPerPost
    });
    
    return {
      followers_count: subscriberCount,
      following_count: 0, // YouTube doesn't have a "following" concept for channels
      posts_count: totalVideos,
      likes_count: totalLikes,
      views_count: totalViews,
      engagement_rate: Math.min(Math.round(finalEngagementRate * 100) / 100, 100), // Cap at 100% and round to 2 decimals
      avg_likes_per_post: avgLikesPerPost,
      avg_comments_per_post: avgCommentsPerPost
    };
    
  } catch (error) {
    console.error('Error fetching YouTube stats:', error);
    
    // Provide more informative error for debugging
    if (error.message?.includes('YouTube API error: 403')) {
      throw new Error('YouTube API access denied. Channel may not have sufficient permissions or analytics access.');
    } else if (error.message?.includes('YouTube API error: 401')) {
      throw new Error('YouTube access token expired. Please reconnect your YouTube account.');
    } else if (error.message?.includes('YouTube API error: 400')) {
      throw new Error('Invalid YouTube API request. Please check your channel settings.');
    }
    
    // Re-throw the original error for other cases
    throw error;
  }
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