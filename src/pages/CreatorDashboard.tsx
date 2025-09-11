import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import SocialMediaStats from '@/components/SocialMediaStats';
import SocialMediaConnections from '@/components/SocialMediaConnections';
import { 
  Eye, 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle, 
  DollarSign,
  Calendar,
  FileText,
  Star,
  TrendingUp
} from 'lucide-react';

interface Campaign {
  id: string;
  title: string;
  description: string;
  budget_min: number;
  budget_max: number;
  deadline: string;
  requirements: string;
  deliverables: string[];
  target_audience: string;
  sponsor_id: string;
  profiles: {
    full_name: string;
  };
}

interface Application {
  id: string;
  proposal: string;
  requested_budget: number;
  status: string;
  applied_at: string;
  reviewed_at: string;
  reviewer_notes: string;
  campaigns: Campaign;
}

interface Collaboration {
  id: string;
  agreed_budget: number;
  deadline: string;
  status: string;
  deliverables: string[];
  campaigns: {
    title: string;
    sponsor_id: string;
  };
  profiles: {
    full_name: string;
  };
}

export default function CreatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse');

  // Redirect if not a creator or not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    const checkUserType = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single();
      
      if (profile?.user_type !== 'creator') {
        navigate('/');
        return;
      }
    };
    
    checkUserType();
  }, [user, navigate]);

  // Load dashboard data
  useEffect(() => {
    if (!user) return;
    
    const loadDashboardData = async () => {
      try {
        // Load available campaigns
        const { data: campaignsData } = await supabase
          .from('campaigns')
          .select(`
            *,
            profiles!campaigns_sponsor_id_fkey(full_name)
          `)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        // Load user's applications
        const { data: applicationsData } = await supabase
          .from('applications')
          .select(`
            *,
            campaigns(
              *,
              profiles!campaigns_sponsor_id_fkey(full_name)
            )
          `)
          .eq('creator_id', user.id)
          .order('applied_at', { ascending: false });

        // Load user's collaborations
        const { data: collaborationsData } = await supabase
          .from('collaborations')
          .select(`
            *,
            campaigns(title, sponsor_id),
            profiles!collaborations_sponsor_id_fkey(full_name)
          `)
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false });

        setCampaigns(campaignsData || []);
        setApplications(applicationsData || []);
        setCollaborations(collaborationsData || []);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load dashboard data',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user, toast]);

  const handleApplyToCampaign = (campaignId: string) => {
    // This will be implemented in the next step
    toast({
      title: 'Coming Soon',
      description: 'Campaign application feature will be added next!'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      accepted: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Creator Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage your campaigns, collaborations, and content
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </div>
        </div>

        {/* Social Media Statistics Section */}
        <div className="mb-8">
          <SocialMediaStats />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Applications</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {applications.filter(app => app.status === 'pending').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Collaborations</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {collaborations.filter(collab => collab.status === 'active').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${collaborations.reduce((sum, collab) => sum + (collab.agreed_budget || 0), 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Campaigns</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaigns.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="browse">Browse Campaigns</TabsTrigger>
            <TabsTrigger value="applications">My Applications</TabsTrigger>
            <TabsTrigger value="collaborations">Collaborations</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
          </TabsList>
          
          {/* Browse Campaigns Tab */}
          <TabsContent value="browse" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Available Campaigns</h2>
              <Badge variant="secondary">{campaigns.length} campaigns</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{campaign.title}</CardTitle>
                    <CardDescription>
                      by {campaign.profiles?.full_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {campaign.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-green-600">
                        <DollarSign className="h-4 w-4 mr-1" />
                        ${campaign.budget_min?.toLocaleString()} - ${campaign.budget_max?.toLocaleString()}
                      </div>
                      {campaign.deadline && (
                        <div className="flex items-center text-muted-foreground">
                          <Calendar className="h-4 w-4 mr-1" />
                          {new Date(campaign.deadline).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    
                    {campaign.deliverables && campaign.deliverables.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {campaign.deliverables.slice(0, 2).map((deliverable, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {deliverable}
                          </Badge>
                        ))}
                        {campaign.deliverables.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{campaign.deliverables.length - 2} more
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleApplyToCampaign(campaign.id)}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Apply
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {campaigns.length === 0 && (
              <Card className="text-center py-8">
                <CardContent>
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No campaigns available</h3>
                  <p className="text-muted-foreground">
                    Check back later for new campaign opportunities!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">My Applications</h2>
              <Badge variant="secondary">{applications.length} applications</Badge>
            </div>
            
            <div className="space-y-4">
              {applications.map((application) => (
                <Card key={application.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{application.campaigns.title}</CardTitle>
                        <CardDescription>
                          Applied {new Date(application.applied_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      {getStatusBadge(application.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium mb-1">Your Proposal</h4>
                        <p className="text-sm text-muted-foreground">{application.proposal}</p>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span>Requested Budget: <strong>${application.requested_budget?.toLocaleString()}</strong></span>
                        {application.reviewed_at && (
                          <span>Reviewed: {new Date(application.reviewed_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      
                      {application.reviewer_notes && (
                        <div>
                          <h4 className="font-medium mb-1">Sponsor Notes</h4>
                          <p className="text-sm text-muted-foreground">{application.reviewer_notes}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {applications.length === 0 && (
              <Card className="text-center py-8">
                <CardContent>
                  <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No applications yet</h3>
                  <p className="text-muted-foreground">
                    Browse available campaigns and submit your first application!
                  </p>
                  <Button 
                    className="mt-4" 
                    onClick={() => setActiveTab('browse')}
                  >
                    Browse Campaigns
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Collaborations Tab */}
          <TabsContent value="collaborations" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Active Collaborations</h2>
              <Badge variant="secondary">{collaborations.length} collaborations</Badge>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {collaborations.map((collaboration) => (
                <Card key={collaboration.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{collaboration.campaigns.title}</CardTitle>
                    <CardDescription>
                      with {collaboration.profiles?.full_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Budget:</span>
                      <span className="font-semibold text-green-600">
                        ${collaboration.agreed_budget?.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Deadline:</span>
                      <span className="font-medium">
                        {new Date(collaboration.deadline).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Status:</span>
                      {getStatusBadge(collaboration.status)}
                    </div>
                    
                    {collaboration.deliverables && collaboration.deliverables.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Deliverables</h4>
                        <div className="flex flex-wrap gap-1">
                          {collaboration.deliverables.map((deliverable, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {deliverable}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <Button variant="outline" className="w-full mt-4">
                      <FileText className="h-4 w-4 mr-2" />
                      Submit Content
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {collaborations.length === 0 && (
              <Card className="text-center py-8">
                <CardContent>
                  <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No active collaborations</h3>
                  <p className="text-muted-foreground">
                    Apply to campaigns to start your first collaboration!
                  </p>
                  <Button 
                    className="mt-4" 
                    onClick={() => setActiveTab('browse')}
                  >
                    Browse Campaigns
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Social Media Tab */}
          <TabsContent value="social" className="space-y-4">
            <SocialMediaConnections />
          </TabsContent>
          
          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Content Library</h2>
            </div>
            
            <Card className="text-center py-8">
              <CardContent>
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Content management coming soon</h3>
                <p className="text-muted-foreground">
                  Upload, manage, and track your content deliverables here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}