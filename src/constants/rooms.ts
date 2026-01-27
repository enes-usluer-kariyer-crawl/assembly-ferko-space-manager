// Room capacity limits configuration
// These values should match the database room capacities

export const ROOM_CAPACITIES: Record<string, number> = {
  'Büyük Oda': 12,
  'Demo Odası': 4,
  'Eğitim Odası': 20,
  'Koltuklu Oda': 5,
  'Masalı Oda': 6
};

// Helper function to get capacity by room name
export function getRoomCapacity(roomName: string): number | undefined {
  return ROOM_CAPACITIES[roomName];
}
