import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Youtube, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play
} from 'lucide-react';

interface TestResult {
  test: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export default function YouTubeIntegrationTest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const addResult = (test: string, status: TestResult['status'], message: string, details?: any) => {
    setResults(prev => [...prev, { test, status, message, details }]);
  };

  const runFullTest = async () => {
    setRunning(true);
    setResults([]);
    
    try {
      // Test 1: Check if user is authenticated
      addResult('Authentication', user ? 'success' : 'error', 
        user ? `User authenticated: ${user.email}` : 'No user authenticated');
      
      if (!user) {
        setRunning(false);
        return;
      }

      // Test 2: Check existing accounts
      addResult('Existing Accounts', 'pending', 'Checking connected accounts...', null);
      
      const { data: accounts, error: accountsError } = await supabase
        .rpc('social_media_accounts_safe');
      
      if (accountsError) {
        addResult('Existing Accounts', 'error', `Error: ${accountsError.message}`, accountsError);
      } else {
        const youtubeAccounts = accounts?.filter((acc: any) => acc.platform === 'youtube') || [];
        addResult('Existing Accounts', 'success', 
          `Found ${youtubeAccounts.length} YouTube accounts`, youtubeAccounts);
      }

      // Test 3: Test OAuth initiation
      addResult('OAuth Initiation', 'pending', 'Testing OAuth URL generation...', null);
      
      try {
        const { data: oauthData, error: oauthError } = await supabase.functions.invoke('social-oauth', {
          body: { 
            action: 'connect',
            platform: 'youtube',
            redirect_url: 'https://nx8up.lovable.app/oauth/callback'
          }
        });

        if (oauthError) {
          addResult('OAuth Initiation', 'error', `OAuth Error: ${oauthError.message}`, oauthError);
        } else if (oauthData?.error) {
          addResult('OAuth Initiation', 'error', `Function Error: ${oauthData.error}`, oauthData);
        } else if (oauthData?.auth_url) {
          addResult('OAuth Initiation', 'success', 'OAuth URL generated successfully', {
            auth_url: oauthData.auth_url.substring(0, 100) + '...',
            state: oauthData.state
          });
        } else {
          addResult('OAuth Initiation', 'warning', 'Unexpected response structure', oauthData);
        }
      } catch (oauthErr: any) {
        addResult('OAuth Initiation', 'error', `Network Error: ${oauthErr.message}`, oauthErr);
      }

      // Test 4: Check database functions
      addResult('Database Functions', 'pending', 'Testing database functions...', null);
      
      try {
        // Test token security function
        const { data: securityData, error: securityError } = await supabase
          .rpc('secure_token_validation');
        
        addResult('Database Functions', securityError ? 'warning' : 'success', 
          securityError ? `Security function error: ${securityError.message}` : 'Security validation working',
          { securityData, securityError });
      } catch (dbErr: any) {
        addResult('Database Functions', 'error', `Database Error: ${dbErr.message}`, dbErr);
      }

      // Test 5: Test stats sync function (if accounts exist)
      if (accounts?.some((acc: any) => acc.platform === 'youtube')) {
        const youtubeAccount = accounts.find((acc: any) => acc.platform === 'youtube');
        addResult('Stats Sync', 'pending', 'Testing stats synchronization...', null);
        
        try {
          const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-social-stats', {
            body: { accountId: youtubeAccount.id }
          });

          if (syncError) {
            addResult('Stats Sync', 'error', `Sync Error: ${syncError.message}`, syncError);
          } else if (syncData?.error) {
            addResult('Stats Sync', 'warning', `Sync Function Error: ${syncData.error}`, syncData);
          } else {
            addResult('Stats Sync', 'success', 'Stats sync completed', syncData);
          }
        } catch (syncErr: any) {
          addResult('Stats Sync', 'error', `Network Error: ${syncErr.message}`, syncErr);
        }
      } else {
        addResult('Stats Sync', 'warning', 'No YouTube accounts to test sync', null);
      }

      // Test 6: Check environment variables (indirectly)
      addResult('Configuration', 'pending', 'Checking configuration...', null);
      
      try {
        // Test if we can reach the edge functions
        const supabaseUrl = 'https://plankbahpovnmigfndqr.supabase.co';
        const response = await fetch(`${supabaseUrl}/functions/v1/social-oauth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYW5rYmFocG92bm1pZ2ZuZHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1OTE2NzUsImV4cCI6MjA3MzE2NzY3NX0.MCtV6So9yWtDifTwWf00p23V2LJ1aSF3aboTEKtjEh8`,
          },
          body: JSON.stringify({ action: 'test' })
        });
        
        addResult('Configuration', response.ok ? 'success' : 'warning', 
          `Edge function reachable: ${response.status}`, { status: response.status });
      } catch (configErr: any) {
        addResult('Configuration', 'error', `Config Error: ${configErr.message}`, configErr);
      }

    } catch (error: any) {
      addResult('General Error', 'error', `Test failed: ${error.message}`, error);
    } finally {
      setRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'pending': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return 'border-green-200 bg-green-50';
      case 'error': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'pending': return 'border-blue-200 bg-blue-50';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Youtube className="h-6 w-6 text-red-500" />
          <CardTitle>YouTube Integration QA Test</CardTitle>
        </div>
        <CardDescription>
          Comprehensive test of the YouTube integration flow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runFullTest} 
          disabled={running}
          className="w-full"
        >
          {running ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Tests...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Full Integration Test
            </>
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Test Results:</h3>
            {results.map((result, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.test}</span>
                  </div>
                  <Badge variant={result.status === 'success' ? 'default' : 'secondary'}>
                    {result.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                {result.details && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer hover:underline">
                      Show Details
                    </summary>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        {!running && results.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted">
            <h4 className="font-medium mb-2">Summary:</h4>
            <div className="grid grid-cols-4 gap-2 text-sm">
              <div className="text-green-600">
                ✅ Passed: {results.filter(r => r.status === 'success').length}
              </div>
              <div className="text-red-600">
                ❌ Failed: {results.filter(r => r.status === 'error').length}
              </div>
              <div className="text-yellow-600">
                ⚠️ Warnings: {results.filter(r => r.status === 'warning').length}
              </div>
              <div className="text-blue-600">
                ⏳ Pending: {results.filter(r => r.status === 'pending').length}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}