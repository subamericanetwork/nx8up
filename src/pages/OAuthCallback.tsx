import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');
    
    // Extract platform from state
    let platform = 'youtube'; // default
    if (state && state.includes('|')) {
      platform = state.split('|')[1];
    }

    console.log('OAuth callback page loaded:', { code: !!code, error, platform });

    // Send message to parent window (popup opener)
    if (window.opener) {
      console.log('Sending message to opener window');
      window.opener.postMessage({
        type: 'OAUTH_CALLBACK',
        code,
        error,
        platform
      }, window.location.origin);
      
      // Close the popup
      window.close();
    } else {
      console.log('No opener window found, redirecting to dashboard');
      // Fallback: redirect to dashboard with params
      window.location.href = `/creator-dashboard?code=${code}&platform=${platform}&error=${error || ''}`;
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Processing your connection...</p>
      </div>
    </div>
  );
}