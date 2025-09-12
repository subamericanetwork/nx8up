import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');
      const state = searchParams.get('state');
      
      console.log('🚀 OAUTH CALLBACK PAGE LOADED:', {
        code: !!code,
        codeLength: code?.length || 0,
        error: errorParam,
        state,
        fullURL: window.location.href,
        searchParams: Object.fromEntries(searchParams.entries()),
        timestamp: new Date().toISOString(),
        hasOpener: !!window.opener,
        openerClosed: window.opener?.closed
      });
      
      // Extract platform from state parameter
      let platform = 'youtube'; // default fallback
      if (state && state.includes('|')) {
        const parts = state.split('|');
        platform = parts[1] || 'youtube';
        console.log('Extracted platform from state:', platform);
      }

      console.log('OAuth callback page loaded:', { 
        hasCode: !!code, 
        error: errorParam, 
        platform,
        codeLength: code?.length || 0
      });

      if (errorParam) {
        console.error('OAuth error parameter:', errorParam);
        setStatus('error');
        setError(errorParam);
        sendMessageToParent({
          type: 'OAUTH_CALLBACK',
          error: errorParam,
          platform
        });
        return;
      }

      if (!code) {
        console.error('No authorization code in URL');
        setStatus('error');
        setError('No authorization code received');
        sendMessageToParent({
          type: 'OAUTH_CALLBACK',
          error: 'No authorization code received',
          platform
        });
        return;
      }

      // Complete the OAuth flow
      completeOAuth(code, platform);
    };

    // Helper function to send messages to parent
    const sendMessageToParent = (message: any) => {
      if (window.opener && !window.opener.closed) {
        try {
          console.log('Sending message to parent:', message);
          
          // Try multiple origins for cross-origin compatibility
          const origins = [
            '*', // Wildcard first
            'https://nx8up.lovable.app', 
            'https://36d74c24-a521-4533-aa15-00a437291e31.sandbox.lovable.dev',
            window.location.origin,
            'http://localhost:8080',
            'https://localhost:8080'
          ];
          
          let messageSent = false;
          origins.forEach(origin => {
            try {
              window.opener.postMessage(message, origin);
              messageSent = true;
              console.log('Message sent to origin:', origin);
            } catch (e) {
              console.log('Failed to send to origin:', origin, e.message);
            }
          });
          
          if (!messageSent) {
            console.error('Failed to send message to any origin');
          }
          
          // Close window with better error handling
          setTimeout(() => {
            try {
              // Check if window can be closed
              if (!window.opener.closed) {
                console.log('Attempting to close popup window');
                window.close();
              }
            } catch (closeError) {
              console.log('Could not close window (cross-origin policy):', closeError.message);
              // Try alternative method
              try {
                window.location.replace('/creator-dashboard');
              } catch (replaceError) {
                window.location.href = '/creator-dashboard';
              }
            }
          }, 1500);
        } catch (postMessageError) {
          console.error('Failed to send message to parent:', postMessageError);
          // Fallback redirect
          try {
            window.location.replace('/creator-dashboard');
          } catch (replaceError) {
            window.location.href = '/creator-dashboard';
          }
        }
      } else {
        console.log('No valid window opener, redirecting to dashboard');
        try {
          window.location.replace('/creator-dashboard');
        } catch (replaceError) {
          window.location.href = '/creator-dashboard';
        }
      }
    };

    // Complete the OAuth flow by calling the edge function
    const completeOAuth = async (code: string, platform: string) => {
      try {
        console.log('Calling edge function to complete OAuth...');
        setStatus('processing');
        
        console.log('Request details:', {
          action: 'callback',
          platform,
          code: code ? `${code.substring(0, 20)}...` : 'MISSING',
          redirect_url: 'https://nx8up.lovable.app/oauth/callback',
          codeLength: code.length
        });

        const { data, error } = await supabase.functions.invoke('social-oauth', {
          body: {
            action: 'callback',
            platform,
            code,
            redirect_url: 'https://nx8up.lovable.app/oauth/callback'
          }
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
        sendMessageToParent({
          type: 'OAUTH_CALLBACK',
          success: true,
          account: data.account,
          platform
        });
        
      } catch (err: any) {
        console.error('OAuth completion error:', err);
        console.error('Error details:', {
          name: err.name,
          message: err.message,
          stack: err.stack
        });
        setStatus('error');
        setError(err.message || 'Failed to complete OAuth');
        
        // Send error message to parent window
        sendMessageToParent({
          type: 'OAUTH_CALLBACK',
          error: err.message || 'Failed to complete OAuth',
          platform
        });
      }
    };

    handleOAuthCallback();
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Connecting your account...</p>
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