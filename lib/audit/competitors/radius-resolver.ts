import {
  URBAN_3DIGIT_PREFIXES,
  URBAN_5DIGIT_OVERRIDES,
  RURAL_3DIGIT_PREFIXES,
} from "./zip-density-data";

type Density = "urban" | "suburban" | "rural";

const RADIUS_BY_DENSITY: Record<Density, number> = {
  urban: 3.0,
  suburban: 5.0,
  rural: 15.0,
};

// Destination retail / specialty services where customers travel further
// than daily-need businesses. NYC brides cross Manhattan for the right
// dress; a 1.5-mi urban radius misses Kleinfeld/Lovely Bride/Tribeca.
const DESTINATION_KEYWORD_PATTERN =
  /\b(bridal|wedding|gown|tuxedo|menswear|jewelry|jeweler|diamond|atelier|couture|luxury|gallery|antique|orthodontist|dermatolog|cosmetic surgeon|plastic surgeon|fertility|ivf|immigration|asylum|estate|hotel)\b/i;

const DESTINATION_MULTIPLIER = 2.5;

export function resolveSearchRadiusMiles(zip: string, keyword?: string): number {
  const base = RADIUS_BY_DENSITY[inferDensity(zip)];
  if (keyword && DESTINATION_KEYWORD_PATTERN.test(keyword)) {
    return base * DESTINATION_MULTIPLIER;
  }
  return base;
}

function inferDensity(zip: string): Density {
  const z = zip.trim();
  if (!z) return "suburban";

  if (URBAN_5DIGIT_OVERRIDES.has(z)) return "urban";

  const prefix3 = z.substring(0, 3);
  if (URBAN_3DIGIT_PREFIXES.has(prefix3)) return "urban";
  if (RURAL_3DIGIT_PREFIXES.has(prefix3)) return "rural";

  return "suburban";
}
