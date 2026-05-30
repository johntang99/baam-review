export interface RawPlaceForHealth {
  business_status?: string;
  url?: string;
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: { periods?: unknown[] };
  types?: string[];
  photos?: unknown[];
}

export interface ProfileHealth {
  is_claimed: boolean;
  is_verified: boolean;
  has_hours: boolean;
  has_phone: boolean;
  has_website: boolean;
  has_categories: boolean;
  has_description: boolean;
  photos_count: number;
  profile_completeness: number;
}

export function evaluateProfileHealth(raw: RawPlaceForHealth): ProfileHealth {
  const is_claimed = raw.business_status === "OPERATIONAL" && !!raw.url;
  const has_hours = !!raw.opening_hours?.periods?.length;
  const has_phone = !!raw.formatted_phone_number;
  const has_website = !!raw.website;
  const has_categories = !!raw.types && raw.types.length > 1;
  const photos_count = raw.photos?.length ?? 0;

  const completenessFlags = [
    is_claimed,
    has_hours,
    has_phone,
    has_website,
    has_categories,
  ];
  const profile_completeness =
    (completenessFlags.filter(Boolean).length / completenessFlags.length) * 100;

  return {
    is_claimed,
    is_verified: is_claimed,
    has_hours,
    has_phone,
    has_website,
    has_categories,
    has_description: false,
    photos_count,
    profile_completeness,
  };
}
