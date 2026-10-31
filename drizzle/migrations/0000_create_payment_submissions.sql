CREATE TABLE public.payment_submissions (
  id uuid PRIMARY KEY,
  amount_inr numeric(12, 2) NOT NULL CHECK (amount_inr > 0),
  utr text NOT NULL,
  payer_phone text NOT NULL,
  qr_slot text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.payment_submissions TO anon, authenticated;
GRANT ALL ON public.payment_submissions TO service_role;

ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visitors can submit payment confirmations"
  ON public.payment_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);