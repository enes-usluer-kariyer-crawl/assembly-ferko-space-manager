export const TEAM_OPTIONS = [
  "Coensio",
  "Satış",
  "Strategy & Business Development",
  "PeopleBox",
  "Techcareer",
  "HR",
  "Technology&Innovation",
  "Product Management&Marketing",
  "Exco",
] as const;

export const LEGACY_TEAM_LABEL = "Belirtilmedi" as const;

export const ALL_TEAM_VALUES = [...TEAM_OPTIONS, LEGACY_TEAM_LABEL] as const;

export type TeamName = (typeof TEAM_OPTIONS)[number];
export type ReservationTeam = (typeof ALL_TEAM_VALUES)[number];

export function isValidReservationTeam(value: string): value is ReservationTeam {
  return (ALL_TEAM_VALUES as readonly string[]).includes(value);
}

