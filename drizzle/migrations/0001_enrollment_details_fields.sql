-- Enrollment flow adds visitor-provided details (nullable first)
ALTER TABLE public.payment_submissions
  ADD COLUMN full_name text,
  ADD COLUMN email text,
  ADD COLUMN contact_number text,
  ADD COLUMN position_applied text,
  ADD COLUMN cohort_date text,
  ADD COLUMN batch_code text,
  ADD COLUMN screenshot_path text;

-- The app stops collecting UTR and a fixed amount; make the old fields
-- optional so inserts without them succeed, and mark them retired.
ALTER TABLE public.payment_submissions
  ALTER COLUMN amount_inr DROP NOT NULL,
  ALTER COLUMN utr DROP NOT NULL;

COMMENT ON COLUMN public.payment_submissions.amount_inr IS 'DEPRECATED: no longer collected — enrollment page defers to the Welcome Letter amount';
COMMENT ON COLUMN public.payment_submissions.utr IS 'DEPRECATED: no longer collected — confirmations now capture enrollment details instead';

-- Anonymous visitors upload payment screenshots to the private bucket
CREATE POLICY "Anyone can upload enrollment screenshots"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'enrollment-screenshots');