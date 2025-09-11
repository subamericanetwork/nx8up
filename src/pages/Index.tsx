import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useNavigate } from "react-router-dom"
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

  if (activeView === 'creator') {
    return <CreatorDashboard onBack={() => setActiveView('landing')} />
  }

  if (activeView === 'sponsor') {
    return <SponsorDashboard onBack={() => setActiveView('landing')} />
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
                <span className="text-sm text-foreground/80">
                  Welcome back!
                </span>
              )}
              <Button 
                variant="ghost" 
                onClick={handleAuthAction}
                className="flex items-center gap-2 text-foreground/80 hover:text-foreground"
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
            <Badge variant="secondary" className="mb-6 bg-primary/10 text-primary border-primary/20">
              Revolutionary Creator Pooling Platform
            </Badge>
            <h1 className="text-6xl font-bold mb-6 bg-brand-gradient bg-clip-text text-transparent">
              NX8UP
            </h1>
            <p className="text-xl text-foreground/80 mb-8 max-w-3xl mx-auto leading-relaxed">
              The first pooling system for nano/micro influencers. Brands buy creator pools, 
              not individual influencers. Performance-based payouts. Automated execution.
            </p>
            <div className="flex gap-4 justify-center">
              <Button 
                variant="hero" 
                size="lg" 
                onClick={() => user ? setActiveView('creator') : navigate('/auth')}
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

const CreatorDashboard = ({ onBack }: { onBack: () => void }) => (
  <div className="min-h-screen bg-background">
    <nav className="border-b px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <h1 className="text-2xl font-bold bg-brand-gradient bg-clip-text text-transparent">NX8UP</h1>
        <Badge variant="outline" className="border-creator-primary text-creator-primary">Creator</Badge>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm"><Settings className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm">Connect Socials</Button>
      </div>
    </nav>

    <div className="container mx-auto p-6">
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
            <Wallet className="h-4 w-4 text-creator-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-creator-primary">$127.40</div>
            <p className="text-xs text-muted-foreground">Next payout at $10</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Play className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">2 autoposts scheduled</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">92%</div>
            <p className="text-xs text-muted-foreground">Above pool average</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>My Pools</CardTitle>
            <CardDescription>Creator pools you've joined</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {['Gaming Creators', 'Tech Reviews', 'Lifestyle'].map((pool) => (
              <div key={pool} className="flex items-center justify-between p-3 bg-brand-gradient-subtle rounded-lg">
                <div>
                  <div className="font-medium">{pool}</div>
                  <div className="text-sm text-muted-foreground">25 members</div>
                </div>
                <Badge variant="outline" className="border-success text-success">Active</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Recent Earnings</CardTitle>
            <CardDescription>Performance-based payouts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { campaign: 'TechGear Q4', amount: '+$45.20', impressions: '12.5K' },
              { campaign: 'Gaming Setup', amount: '+$32.15', impressions: '8.9K' },
              { campaign: 'Holiday Style', amount: '+$28.40', impressions: '7.2K' }
            ].map((earning, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <div className="font-medium">{earning.campaign}</div>
                  <div className="text-sm text-muted-foreground">{earning.impressions} impressions</div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-success">{earning.amount}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
)

const SponsorDashboard = ({ onBack }: { onBack: () => void }) => (
  <div className="min-h-screen bg-background">
    <nav className="border-b px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <h1 className="text-2xl font-bold bg-brand-gradient bg-clip-text text-transparent">NX8UP</h1>
        <Badge variant="outline" className="border-sponsor-primary text-sponsor-primary">Sponsor</Badge>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm"><Settings className="h-4 w-4" /></Button>
        <Button variant="primary" size="sm">Create Campaign</Button>
      </div>
    </nav>

    <div className="container mx-auto p-6">
      <div className="grid lg:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <BarChart3 className="h-4 w-4 text-sponsor-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-sponsor-primary">5</div>
            <p className="text-xs text-muted-foreground">2 pending approval</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">2.4M</div>
            <p className="text-xs text-muted-foreground">Impressions this month</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">4.2%</div>
            <p className="text-xs text-muted-foreground">Above industry avg</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campaign ROI</CardTitle>
            <Target className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">8.5x</div>
            <p className="text-xs text-muted-foreground">Return on investment</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Available Pools</CardTitle>
            <CardDescription>Curated creator pools ready for campaigns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: 'Gaming Creators', size: 32, reach: '890K', engagement: '5.2%', price: '$4,999' },
              { name: 'Tech Reviewers', size: 18, reach: '520K', engagement: '6.1%', price: '$2,999' },
              { name: 'Lifestyle Creators', size: 45, reach: '1.2M', engagement: '4.8%', price: '$7,999' }
            ].map((pool, i) => (
              <div key={i} className="p-4 border rounded-lg hover:shadow-brand transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{pool.name}</h3>
                  <Badge variant="secondary">{pool.size} creators</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground mb-3">
                  <div>Reach: {pool.reach}</div>
                  <div>Eng: {pool.engagement}</div>
                  <div className="font-semibold text-foreground">{pool.price}</div>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  View Details
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>Real-time metrics from active campaigns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: 'Holiday Electronics', status: 'Live', impressions: '245K', engagement: '5.8%' },
              { name: 'Q4 Gaming Gear', status: 'Live', impressions: '189K', engagement: '4.9%' },
              { name: 'New Year Fitness', status: 'Pending', impressions: '0', engagement: '0%' }
            ].map((campaign, i) => (
              <div key={i} className="p-4 bg-brand-gradient-subtle rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{campaign.name}</h3>
                  <Badge variant={campaign.status === 'Live' ? 'default' : 'secondary'}>
                    {campaign.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Impressions</div>
                    <div className="font-medium">{campaign.impressions}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Engagement</div>
                    <div className="font-medium">{campaign.engagement}</div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
)

export default Index