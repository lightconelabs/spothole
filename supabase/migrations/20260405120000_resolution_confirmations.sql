-- Resolution confirmations table
-- Allows authenticated users to confirm that an issue has been resolved.
-- Each user can confirm once per report (unique constraint).
-- After 3 confirmations, the report status is automatically set to 'resolved'.
CREATE TABLE resolution_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);

-- RLS policies
ALTER TABLE resolution_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Confirmations are viewable by everyone"
  ON resolution_confirmations FOR SELECT USING (true);

CREATE POLICY "Authenticated users can confirm"
  ON resolution_confirmations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policies: confirmations are permanent (prevents tag game)

-- Index for fast lookup by report
CREATE INDEX idx_confirmations_report_id ON resolution_confirmations (report_id);

-- Auto-resolve function: when a report reaches 3 confirmations, set status to 'resolved'
CREATE OR REPLACE FUNCTION check_resolution_threshold()
RETURNS TRIGGER AS $$
DECLARE
  confirmation_count INT;
BEGIN
  SELECT count(*) INTO confirmation_count
  FROM resolution_confirmations
  WHERE report_id = NEW.report_id;

  IF confirmation_count >= 3 THEN
    UPDATE reports
    SET status = 'resolved'
    WHERE id = NEW.report_id
      AND status != 'resolved';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_confirmation_check_threshold
  AFTER INSERT ON resolution_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION check_resolution_threshold();
