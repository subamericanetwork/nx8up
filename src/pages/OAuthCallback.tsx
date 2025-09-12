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
        console.log('✅ Extracted platform from state:', platform);
      } else {
        console.log('⚠️ No state parameter or invalid format, using default platform:', platform);
      }

      console.log('📋 OAuth callback parameters:', { 
        hasCode: !!code, 
        error: errorParam, 
        platform,
        codeLength: code?.length || 0,
        actualCode: code ? `${code.substring(0, 10)}...${code.substring(code.length - 10)}` : 'MISSING',
        fullState: state,
        currentURL: window.location.href,
        searchString: window.location.search
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
      console.log('🔄 OAUTH CALLBACK: Sending message to parent:', message);
      
      // Primary method: localStorage (bypasses COOP restrictions)
      const oauthResult = {
        ...message,
        timestamp: Date.now(),
        platform: message.platform,
        url: window.location.href
      };
      
      try {
        localStorage.setItem('oauth_result', JSON.stringify(oauthResult));
        console.log('✅ OAUTH CALLBACK: Result stored in localStorage:', oauthResult);
        
        // Also try to trigger a storage event manually
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'oauth_result',
          newValue: JSON.stringify(oauthResult),
          url: window.location.href
        }));
        console.log('✅ OAUTH CALLBACK: Storage event dispatched');
      } catch (e) {
        console.error('❌ OAUTH CALLBACK: Failed to store OAuth result in localStorage:', e);
      }
      
      // Backup method: Try postMessage (will likely fail due to COOP)
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(message, '*');
          console.log('✅ OAUTH CALLBACK: PostMessage sent (backup method)');
        } catch (e) {
          console.log('⚠️ OAUTH CALLBACK: PostMessage failed as expected due to COOP:', e.message);
        }
      } else {
        console.log('⚠️ OAUTH CALLBACK: No opener window available');
      }
      
      // Show success message to user in popup
      if (message.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setError(message.error || 'OAuth failed');
      }
      
      // Close popup after delay
      setTimeout(() => {
        console.log('🔄 OAUTH CALLBACK: Attempting to close popup window');
        try {
          window.close();
        } catch (closeError) {
          console.log('⚠️ OAUTH CALLBACK: Cannot close popup, redirecting:', closeError.message);
          window.location.href = '/creator-dashboard';
        }
      }, 2000); // Increased delay for user to see success message
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

        console.log('🔄 About to call social-oauth edge function...');
        console.log('🔍 Full request payload:', {
          action: 'callback',
          platform,
          code: code ? `${code.substring(0, 15)}...${code.substring(code.length - 15)}` : 'MISSING',
          redirect_url: 'https://nx8up.lovable.app/creator-dashboard',
          codeLength: code?.length,
          platformType: typeof platform,
          codeType: typeof code
        });
        
        const { data, error } = await supabase.functions.invoke('social-oauth', {
          body: {
            action: 'callback',
            platform,
            code,
            redirect_url: 'https://nx8up.lovable.app/creator-dashboard'
          }
        });

        console.log('📤 Edge function response:', { 
          data, 
          error, 
          hasData: !!data,
          hasError: !!error,
          dataType: typeof data,
          errorType: typeof error
        });

        if (error) {
          console.error('❌ Supabase function error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            status: error.status,
            statusText: error.statusText,
            stack: error.stack,
            name: error.name
          });
          throw error;
        }

        if (data?.error) {
          console.error('❌ OAUTH CALLBACK: Function returned error:', data.error);
          console.error('❌ OAUTH CALLBACK: Error details:', data.details);
          console.error('❌ OAUTH CALLBACK: Debug info:', data.debug);
          
          // Create detailed error message
          let errorMessage = data.error;
          if (data.details?.error_description) {
            errorMessage += `: ${data.details.error_description}`;
          } else if (data.details?.raw_error) {
            errorMessage += `: ${data.details.raw_error}`;
          }
          
          console.error('❌ OAUTH CALLBACK: Full error context:', {
            mainError: data.error,
            details: data.details,
            debug: data.debug,
            status: data.status,
            step: data.step,
            requestId: data.requestId
          });
          
          throw new Error(errorMessage);
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