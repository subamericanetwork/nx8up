-- Create enum for application status
CREATE TYPE public.application_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');

-- Applications table (creators applying to campaigns)
CREATE TABLE public.applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposal TEXT NOT NULL,
  requested_budget DECIMAL(10,2),
  status public.application_status NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_notes TEXT,
  UNIQUE(campaign_id, creator_id)
);

-- Enable RLS on applications table
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for applications
CREATE POLICY "Creators can create applications" ON public.applications
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can view their own applications" ON public.applications
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Sponsors can view applications to their campaigns" ON public.applications
  FOR SELECT USING (
    auth.uid() IN (
      SELECT sponsor_id FROM public.campaigns WHERE id = campaign_id
    )
  );

CREATE POLICY "Sponsors can update applications to their campaigns" ON public.applications
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT sponsor_id FROM public.campaigns WHERE id = campaign_id
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_applications_campaign_id ON public.applications(campaign_id);
CREATE INDEX idx_applications_creator_id ON public.applications(creator_id);
CREATE INDEX idx_applications_status ON public.applications(status);