import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const state = searchParams.get('state');
    
    // Extract platform from state
    let platform = 'youtube'; // default
    if (state && state.includes('|')) {
      platform = state.split('|')[1];
    }

    console.log('OAuth callback page loaded:', { code: !!code, error: errorParam, platform });

    if (errorParam) {
      setStatus('error');
      setError(errorParam);
      if (window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_CALLBACK',
          error: errorParam,
          platform
        }, window.location.origin);
        window.close();
      }
      return;
    }

    if (!code) {
      setStatus('error');
      setError('No authorization code received');
      if (window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_CALLBACK',
          error: 'No authorization code received',
          platform
        }, window.location.origin);
        window.close();
      }
      return;
    }

    // Complete the OAuth flow by calling the edge function
    const completeOAuth = async () => {
      try {
        console.log('Calling edge function to complete OAuth...');
        
        // Get current user session for the authorization header
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          throw new Error('No user session found');
        }

        const { data, error } = await supabase.functions.invoke('social-oauth', {
          body: {
            action: 'callback',
            platform,
            code,
            redirect_url: `${window.location.origin}/oauth/callback`
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (error) {
          throw new Error(error.message || 'OAuth completion failed');
        }

        if (data.error) {
          throw new Error(data.error);
        }

        console.log('OAuth completion successful:', data);
        setStatus('success');
        
        // Send success message to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'OAUTH_CALLBACK',
            success: true,
            account: data.account,
            platform
          }, window.location.origin);
          
          // Close the popup after a brief delay
          setTimeout(() => {
            window.close();
          }, 1000);
        } else {
          // Fallback: redirect to dashboard
          window.location.href = '/creator-dashboard';
        }
        
      } catch (err) {
        console.error('OAuth completion error:', err);
        setStatus('error');
        setError(err.message || 'Failed to complete OAuth');
        
        // Send error message to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'OAUTH_CALLBACK',
            error: err.message || 'Failed to complete OAuth',
            platform
          }, window.location.origin);
          window.close();
        }
      }
    };

    completeOAuth();
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Connecting your YouTube account...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-500 text-4xl mb-4">✓</div>
            <p className="text-green-600 font-medium">Account connected successfully!</p>
            <p className="text-muted-foreground text-sm mt-2">This window will close automatically...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-500 text-4xl mb-4">✗</div>
            <p className="text-red-600 font-medium">Connection failed</p>
            <p className="text-muted-foreground text-sm mt-2">{error}</p>
          </>
        )}
      </div>
    </div>
  );
}