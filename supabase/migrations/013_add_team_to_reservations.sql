-- Add team information to reservations so team reports can be automated

ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS team TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_team_check'
      AND conrelid = 'public.reservations'::regclass
  ) THEN
    ALTER TABLE public.reservations
    ADD CONSTRAINT reservations_team_check
    CHECK (
      team IS NULL
      OR team IN (
        'Coensio',
        'Satış',
        'Strategy & Business Development',
        'PeopleBox',
        'Techcareer',
        'HR',
        'Technology&Innovation',
        'Product Management&Marketing',
        'Exco',
        'Belirtilmedi'
      )
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_reservations_team ON public.reservations(team);
