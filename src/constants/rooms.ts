// Room capacity limits configuration
// These values should match the database room capacities

export const ROOM_CAPACITIES: Record<string, number> = {
  'Büyük Oda': 12,
  'Demo Odası': 4,
  'Eğitim Odası': 20,
  'Koltuklu Oda': 5,
  'Masalı Oda': 6
};

// Mapping of Parent Room Name -> Child Room Names
// When a parent room (Combined Room) is cancelled, these sub-rooms should also be released.
// TODO: Verify the correct mapping for your specific room setup.
export const COMBINED_ROOMS: Record<string, string[]> = {
  'Büyük Oda': ['Eğitim Odası', 'Demo Odası'] 
};

// Helper function to get capacity by room name
export function getRoomCapacity(roomName: string): number | undefined {
  return ROOM_CAPACITIES[roomName];
}
