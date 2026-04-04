-- Categories enum
CREATE TYPE report_category AS ENUM ('pothole', 'litter', 'garbage_bin', 'graffiti', 'other');

-- Status enum
CREATE TYPE report_status AS ENUM ('pending', 'acknowledged', 'resolved');

-- Reports table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category report_category NOT NULL,
  description TEXT CHECK (char_length(description) <= 500),
  latitude FLOAT8 NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude FLOAT8 NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  address TEXT,
  photo_url TEXT NOT NULL,
  status report_status NOT NULL DEFAULT 'pending',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS policies
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reports are viewable by everyone" ON reports FOR SELECT USING (true);
CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own reports" ON reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reports" ON reports FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can manage own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Storage bucket for report photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('report-photos', 'report-photos', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'report-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Photos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'report-photos');

-- Indexes
CREATE INDEX idx_reports_location ON reports (latitude, longitude);
CREATE INDEX idx_reports_created_at ON reports (created_at DESC);
