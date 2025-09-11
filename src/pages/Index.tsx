import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, TrendingUp, Target, Zap, ArrowRight, Play, BarChart3, Wallet, Settings, LogOut } from "lucide-react"
import heroImage from "@/assets/nx8up-hero.jpg"

const Index = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'landing' | 'creator' | 'sponsor'>('landing')

  const handleAuthAction = () => {
    if (user) {
      signOut();
    } else {
      navigate('/auth');
    }
  };

  const handleCreatorAction = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    // Always redirect creators to dashboard
    navigate('/creator-dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={heroImage} 
            alt="NX8UP Network Visualization" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-brand-gradient-subtle" />
        </div>
        <div className="relative z-10 container mx-auto px-4 py-20">
          {/* Navigation */}
          <nav className="flex justify-between items-center mb-16">
            <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              NX8UP
            </div>
            <div className="flex gap-4 items-center">
              {user && (
                <span className="text-sm text-white">
                  Welcome back!
                </span>
              )}
              <Button 
                variant="ghost" 
                onClick={handleAuthAction}
                className="flex items-center gap-2 text-white hover:text-white/90"
              >
                {user ? (
                  <>
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </>
                ) : (
                  'Login'
                )}
              </Button>
              {!user && (
                <Button 
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                  onClick={() => navigate('/auth')}
                >
                  Get Started
                </Button>
              )}
            </div>
          </nav>

          <div className="text-center">
            <Badge variant="secondary" className="mb-6 bg-primary/10 text-blue-300 border-primary/20">
              Revolutionary Creator Pooling Platform
            </Badge>
            <h1 className="text-6xl font-bold mb-6 bg-brand-gradient bg-clip-text text-transparent">
              NX8UP
            </h1>
            <p className="text-xl text-white mb-8 max-w-3xl mx-auto leading-relaxed">
              The first pooling system for nano/micro influencers. Brands buy creator pools, 
              not individual influencers. Performance-based payouts. Automated execution.
            </p>
            <div className="flex gap-4 justify-center">
              <Button 
                variant="hero" 
                size="lg" 
                onClick={handleCreatorAction}
                className="shadow-brand"
              >
                Join as Creator <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="heroSecondary" 
                size="lg"
                onClick={() => user ? setActiveView('sponsor') : navigate('/auth')}
              >
                Browse Pools <Target className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">How NX8UP Changes Everything</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Performance-based pooling that benefits both creators and brands
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Users className="h-8 w-8 text-creator-primary" />}
            title="Creator Pools"
            description="Join curated pools by category. Gaming, Fashion, Music, and more. Get discovered by brands through collective power."
          />
          <FeatureCard
            icon={<TrendingUp className="h-8 w-8 text-sponsor-primary" />}
            title="Performance Payouts"
            description="Earnings based on actual impressions. Top performers get rewarded. Fair, transparent, automated."
          />
          <FeatureCard
            icon={<Zap className="h-8 w-8 text-warning" />}
            title="Auto Execution"
            description="Campaigns auto-post across your chosen social platforms. Set it and forget it. Focus on creating."
          />
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-brand-gradient-subtle">
        <div className="container mx-auto px-4 text-center">
          <div className="grid md:grid-cols-4 gap-8">
            <StatCard title="Creator Pools" value="12+" />
            <StatCard title="Avg Pool Size" value="25" />
            <StatCard title="Campaigns Live" value="8" />
            <StatCard title="Total Payouts" value="$47K" />
          </div>
        </div>
      </section>
    </div>
  )
}

const FeatureCard = ({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) => (
  <Card className="shadow-card hover:shadow-brand transition-shadow duration-300">
    <CardHeader className="text-center">
      <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-brand-gradient-subtle flex items-center justify-center">
        {icon}
      </div>
      <CardTitle className="text-xl">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <CardDescription className="text-center text-base">
        {description}
      </CardDescription>
    </CardContent>
  </Card>
)

const StatCard = ({ title, value }: { title: string; value: string }) => (
  <div className="text-center">
    <div className="text-4xl font-bold text-primary mb-2">{value}</div>
    <div className="text-muted-foreground">{title}</div>
  </div>
)

export default Index