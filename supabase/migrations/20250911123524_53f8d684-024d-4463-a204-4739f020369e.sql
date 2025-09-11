-- Create enums for content
CREATE TYPE public.content_status AS ENUM ('pending', 'submitted', 'approved', 'rejected', 'revision_requested');
CREATE TYPE public.content_type AS ENUM ('post', 'story', 'video', 'reel', 'blog', 'other');

-- Content table (deliverables from creators)
CREATE TABLE public.content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaboration_id UUID NOT NULL REFERENCES public.collaborations(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content_type public.content_type NOT NULL,
  content_url TEXT,
  thumbnail_url TEXT,
  platform TEXT, -- Instagram, TikTok, YouTube, etc.
  metrics JSONB, -- Views, likes, comments, etc.
  status public.content_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on content table
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

-- RLS Policies for content
CREATE POLICY "Content creators can manage their content" ON public.content
  FOR ALL USING (auth.uid() = creator_id);

CREATE POLICY "Sponsors can view content for their collaborations" ON public.content
  FOR SELECT USING (
    auth.uid() IN (
      SELECT sponsor_id FROM public.collaborations WHERE id = collaboration_id
    )
  );

CREATE POLICY "Sponsors can update content status for their collaborations" ON public.content
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT sponsor_id FROM public.collaborations WHERE id = collaboration_id
    )
  );

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON public.content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_content_collaboration_id ON public.content(collaboration_id);
CREATE INDEX idx_content_creator_id ON public.content(creator_id);
CREATE INDEX idx_content_status ON public.content(status);
CREATE INDEX idx_content_type ON public.content(content_type);