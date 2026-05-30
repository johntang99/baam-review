type Density = "urban" | "suburban" | "rural";

const RADIUS_BY_DENSITY: Record<Density, number> = {
  urban: 1.5,
  suburban: 5.0,
  rural: 15.0,
};

const NYC_METRO_ZIP_PREFIXES_URBAN = [
  "100", "101", "102",
  "104",
  "110", "111", "112", "113", "114",
  "11354", "11355", "11356", "11357", "11358", "11361", "11362", "11363", "11364", "11365", "11366", "11367", "11368",
  "11373", "11375", "11377",
];

const NYC_METRO_ZIP_PREFIXES_SUBURBAN = [
  "115", "116", "117", "118", "119",
  "070", "071", "072", "073", "074", "075", "076", "077",
];

export function resolveSearchRadiusMiles(zip: string): number {
  return RADIUS_BY_DENSITY[inferDensity(zip)];
}

function inferDensity(zip: string): Density {
  const z = zip.trim();
  if (!z) return "suburban";

  for (const prefix of NYC_METRO_ZIP_PREFIXES_URBAN) {
    if (z === prefix || z.startsWith(prefix)) return "urban";
  }

  for (const prefix of NYC_METRO_ZIP_PREFIXES_SUBURBAN) {
    if (z.startsWith(prefix)) return "suburban";
  }

  return "suburban";
}
