type ManufacturerDetailRule = {
  service: string;
  pattern: RegExp;
};

const MANUFACTURER_DETAIL_RULES: readonly ManufacturerDetailRule[] = [
  {
    service: "kitchen cabinet manufacturer",
    pattern:
      /(kitchen\s*cabinets?|cabinets?|cabinetry|cabinet\s*doors?|millwork|joinery|wood\s*cabinetry)/i,
  },
  {
    service: "countertop manufacturer",
    pattern:
      /(countertops?|stone\s*tops?|granite|quartz|solid\s*surface|engineered\s*stone|kitchen\s*tops?)/i,
  },
  {
    service: "sign manufacturer",
    pattern:
      /(signs?|signage|channel\s*letters?|light\s*boxes?|led\s*signs?|wayfinding)/i,
  },
  {
    service: "metal fabrication manufacturer",
    pattern:
      /(metalworks?|metal\s*fabrication|sheet\s*metal|steel\s*fabrication|aluminum\s*fabrication|cnc\s*machining)/i,
  },
  {
    service: "electronics manufacturer",
    pattern:
      /(electronics?|electronic\s*components?|pcb|circuit\s*boards?|semiconductor|ems)/i,
  },
  {
    service: "furniture manufacturer",
    pattern: /(furniture|sofas?|chairs?|tables?|bedroom\s*sets?)/i,
  },
  {
    service: "food manufacturer",
    pattern:
      /(foods?|snacks?|beverages?|frozen\s*foods?|nutrition\s*products?|confectionery)/i,
  },
  {
    service: "packaging manufacturer",
    pattern: /(packaging|cartons?|boxes?|labels?|containers?|bottles?)/i,
  },
  {
    service: "textile manufacturer",
    pattern: /(textiles?|garments?|apparel|fabrics?|knitwear)/i,
  },
  {
    service: "plastic manufacturer",
    pattern:
      /(plastics?|polymer|injection\s*molding|blow\s*molding|resin\s*products?)/i,
  },
  {
    service: "automotive parts manufacturer",
    pattern:
      /(auto\s*parts?|automotive\s*parts?|aftermarket\s*parts?|brake\s*pads?|engine\s*parts?|headlights?|tail\s*lights?|taillights?|fog\s*lights?|car\s*lights?|truck\s*lights?)/i,
  },
  {
    service: "lighting manufacturer",
    pattern:
      /(led\s*lighting|lighting\s*fixtures?|luminaires?|lamp\s*manufacturing|light\s*factory)/i,
  },
];

const MANUFACTURER_SIGNAL_PATTERN =
  /\b(manufactur(er|ing)|factory|production plant|oem|industrial plant)\b/i;

export function hasManufacturerSignalText(
  text: string | null | undefined,
  hasManufacturerType = false,
) {
  if (hasManufacturerType) return true;
  if (!text) return false;
  return MANUFACTURER_SIGNAL_PATTERN.test(text);
}

export function inferDetailedManufacturerService({
  text,
  hasManufacturerSignal,
}: {
  text: string | null | undefined;
  hasManufacturerSignal: boolean;
}) {
  if (!text || !hasManufacturerSignal) return "";
  for (const rule of MANUFACTURER_DETAIL_RULES) {
    if (rule.pattern.test(text)) return rule.service;
  }
  return "";
}
