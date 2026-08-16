-- Add "WeConsulting" to the allowed reservation teams

ALTER TABLE public.reservations
DROP CONSTRAINT IF EXISTS reservations_team_check;

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
    'WeConsulting',
    'Belirtilmedi'
  )
);
