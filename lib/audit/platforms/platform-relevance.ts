import type { VerticalKey } from "../google/types";
import type { PlatformRelevance } from "./types";

export const PLATFORM_VERTICAL_RELEVANCE: Record<VerticalKey, PlatformRelevance> = {
  tcm_clinic:        { yelp: true, zocdoc: true,  healthgrades: true,  facebook: true },
  dental:            { yelp: true, zocdoc: true,  healthgrades: true,  facebook: true },
  legal_immigration: { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  restaurant:        { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  real_estate:       { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  hotel:             { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  auto:              { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  contractor:        { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  salon_spa:         { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  cafe:              { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  apparel:           { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  health_food:       { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  insurance:         { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
  general_smb:       { yelp: true, zocdoc: false, healthgrades: false, facebook: true },
};
