const RANK_NAMES: Record<number, string> = {
  0: "Unranked",
  1: "Unused 1", 2: "Unused 2",
  3: "Iron 1", 4: "Iron 2", 5: "Iron 3",
  6: "Bronze 1", 7: "Bronze 2", 8: "Bronze 3",
  9: "Silver 1", 10: "Silver 2", 11: "Silver 3",
  12: "Gold 1", 13: "Gold 2", 14: "Gold 3",
  15: "Platinum 1", 16: "Platinum 2", 17: "Platinum 3",
  18: "Diamond 1", 19: "Diamond 2", 20: "Diamond 3",
  21: "Ascendant 1", 22: "Ascendant 2", 23: "Ascendant 3",
  24: "Immortal 1", 25: "Immortal 2", 26: "Immortal 3",
  27: "Radiant",
};

export function rankName(tier: number): string {
  return RANK_NAMES[tier] || "Unranked";
}

export function rankIcon(tier: number): string {
  if (tier === 0) return "";
  return `https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/${tier}/smallicon.png`;
}

export function mapName(mapId: string): string {
  const MAP_NAMES: Record<string, string> = {
    "Ascent": "Ascent",
    "Duality": "Bind",
    "Bonsai": "Split",
    "Triad": "Haven",
    "Port": "Icebox",
    "Foxtrot": "Breeze",
    "Canyon": "Fracture",
    "Pitt": "Pearl",
    "Jam": "Lotus",
    "Juliett": "Sunset",
    "Infinity": "Abyss",
    "Rook": "Corrode",
    "Delta": "Drift",
    "Glitch": "Glitch",
    "Range": "The Range",
    "HURM_Alley": "District",
    "HURM_Bowl": "Kasbah",
    "HURM_Yard": "Piazza",
    "HURM_Helix": "Drift",
  };
  for (const [key, name] of Object.entries(MAP_NAMES)) {
    if (mapId.includes(key)) return name;
  }
  console.log("[map] unknown mapId:", mapId);
  return "Unknown";
}
