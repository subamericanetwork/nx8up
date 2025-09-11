-- Create enum for collaboration status
CREATE TYPE public.collaboration_status AS ENUM ('active', 'completed', 'cancelled', 'disputed');

-- Collaborations table (accepted partnerships)
CREATE TABLE public.collaborations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  agreed_budget DECIMAL(10,2) NOT NULL,
  deliverables TEXT[] NOT NULL,
  deadline DATE NOT NULL,
  status public.collaboration_status NOT NULL DEFAULT 'active',
  contract_terms TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on collaborations table
ALTER TABLE public.collaborations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for collaborations
CREATE POLICY "Collaborators can view their collaborations" ON public.collaborations
  FOR SELECT USING (auth.uid() = sponsor_id OR auth.uid() = creator_id);

CREATE POLICY "Sponsors can create collaborations" ON public.collaborations
  FOR INSERT WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY "Collaborators can update their collaborations" ON public.collaborations
  FOR UPDATE USING (auth.uid() = sponsor_id OR auth.uid() = creator_id);

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_collaborations_updated_at
  BEFORE UPDATE ON public.collaborations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_collaborations_campaign_id ON public.collaborations(campaign_id);
CREATE INDEX idx_collaborations_sponsor_id ON public.collaborations(sponsor_id);
CREATE INDEX idx_collaborations_creator_id ON public.collaborations(creator_id);
CREATE INDEX idx_collaborations_status ON public.collaborations(status);