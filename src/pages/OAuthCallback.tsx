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
        try {
          window.opener.postMessage({
            type: 'OAUTH_CALLBACK',
            error: errorParam,
            platform
          }, '*'); // Use '*' for cross-origin messaging
          window.close();
        } catch (postMessageError) {
          console.error('Failed to send error to parent:', postMessageError);
          window.close();
        }
      }
      return;
    }

    if (!code) {
      setStatus('error');
      setError('No authorization code received');
      if (window.opener) {
        try {
          window.opener.postMessage({
            type: 'OAUTH_CALLBACK',
            error: 'No authorization code received',
            platform
          }, '*'); // Use '*' for cross-origin messaging
          window.close();
        } catch (postMessageError) {
          console.error('Failed to send error to parent:', postMessageError);
          window.close();
        }
      }
      return;
    }

    // Complete the OAuth flow by calling the edge function
    const completeOAuth = async () => {
      try {
        console.log('Calling edge function to complete OAuth...');
        
        // Get current user session for the authorization header
        const { data: { session } } = await supabase.auth.getSession();
        
        console.log('Request details:', {
          action: 'callback',
          platform,
          code: code ? `${code.substring(0, 20)}...` : 'MISSING',
          redirect_url: `${window.location.origin}/oauth/callback`,
          session_exists: !!session
        });
        
        // Session is not required since JWT verification is disabled
        console.log('Proceeding without session validation (JWT verification disabled)');

        const { data, error } = await supabase.functions.invoke('social-oauth', {
          body: {
            action: 'callback',
            platform,
            code,
            redirect_url: 'https://nx8up.lovable.app/oauth/callback'
          }
          // Removed Authorization header since JWT verification is disabled
        });

        console.log('Edge function response:', { data, error });

        if (error) {
          console.error('Supabase function error:', error);
          throw new Error(error.message || 'OAuth completion failed');
        }

        if (data?.error) {
          console.error('Function returned error:', data.error);
          throw new Error(data.error);
        }

        console.log('OAuth completion successful:', data);
        setStatus('success');
        
        // Send success message to parent window
        if (window.opener) {
          try {
            console.log('Sending success message to parent window...');
            window.opener.postMessage({
              type: 'OAUTH_CALLBACK',
              success: true,
              account: data.account,
              platform
            }, '*'); // Use '*' for cross-origin messaging
            
            // Close the popup after a brief delay
            setTimeout(() => {
              try {
                window.close();
              } catch (closeError) {
                console.log('Could not close window, redirecting instead');
                window.location.href = '/creator-dashboard';
              }
            }, 1000);
          } catch (postMessageError) {
            console.error('Failed to send message to parent:', postMessageError);
            // Fallback: redirect to dashboard
            window.location.href = '/creator-dashboard';
          }
        } else {
          // Fallback: redirect to dashboard
          console.log('No window opener, redirecting to dashboard');
          window.location.href = '/creator-dashboard';
        }
        
      } catch (err) {
        console.error('OAuth completion error:', err);
        console.error('Error details:', {
          name: err.name,
          message: err.message,
          stack: err.stack
        });
        setStatus('error');
        setError(err.message || 'Failed to complete OAuth');
        
        // Send error message to parent window
        if (window.opener) {
          try {
            console.log('Sending error message to parent window...');
            window.opener.postMessage({
              type: 'OAUTH_CALLBACK',
              error: err.message || 'Failed to complete OAuth',
              platform
            }, '*'); // Use '*' for cross-origin messaging
            
            setTimeout(() => {
              try {
                window.close();
              } catch (closeError) {
                console.log('Could not close window, redirecting instead');
                window.location.href = '/creator-dashboard';
              }
            }, 1000);
          } catch (postMessageError) {
            console.error('Failed to send error to parent:', postMessageError);
            setTimeout(() => {
              try {
                window.close();
              } catch (closeError) {
                console.log('Could not close window, redirecting instead');
                window.location.href = '/creator-dashboard';
              }
            }, 1000);
          }
        } else {
          console.log('No window opener, redirecting to dashboard');
          window.location.href = '/creator-dashboard';
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