-- Create enum types for better data consistency
CREATE TYPE public.campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'cancelled');

-- Campaigns table (created by sponsors)
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sponsor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  budget_min DECIMAL(10,2),
  budget_max DECIMAL(10,2),
  target_audience TEXT,
  campaign_goals TEXT,
  deliverables TEXT[],
  deadline DATE,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on campaigns table
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns
CREATE POLICY "Anyone can view active campaigns" ON public.campaigns
  FOR SELECT USING (status = 'active');

CREATE POLICY "Sponsors can create campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY "Sponsors can update their own campaigns" ON public.campaigns
  FOR UPDATE USING (auth.uid() = sponsor_id);

CREATE POLICY "Sponsors can view their own campaigns" ON public.campaigns
  FOR SELECT USING (auth.uid() = sponsor_id);

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_campaigns_sponsor_id ON public.campaigns(sponsor_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);