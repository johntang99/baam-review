type ManufacturerDetailRule = {
  service: string;
  pattern: RegExp;
};

const MANUFACTURER_DETAIL_RULES: readonly ManufacturerDetailRule[] = [
  {
    service: "kitchen cabinet manufacturer",
    pattern: /\b(kitchen cabinets?|cabinets?|cabinetry|millwork|joinery)\b/i,
  },
  {
    service: "countertop manufacturer",
    pattern: /\b(countertops?|stone tops?|granite|quartz|solid surface)\b/i,
  },
  {
    service: "sign manufacturer",
    pattern:
      /\b(signs?|signage|channel letters?|light boxes?|led signs?|wayfinding)\b/i,
  },
  {
    service: "metal fabrication manufacturer",
    pattern:
      /\b(metalworks?|metal fabrication|sheet metal|steel fabrication|aluminum fabrication|cnc machining)\b/i,
  },
  {
    service: "electronics manufacturer",
    pattern:
      /\b(electronics?|electronic components?|pcb|circuit boards?|semiconductor|ems)\b/i,
  },
  {
    service: "furniture manufacturer",
    pattern: /\b(furniture|sofas?|chairs?|tables?|bedroom sets?)\b/i,
  },
  {
    service: "food manufacturer",
    pattern:
      /\b(foods?|snacks?|beverages?|frozen foods?|nutrition products?|confectionery)\b/i,
  },
  {
    service: "packaging manufacturer",
    pattern: /\b(packaging|cartons?|boxes?|labels?|containers?|bottles?)\b/i,
  },
  {
    service: "textile manufacturer",
    pattern: /\b(textiles?|garments?|apparel|fabrics?|knitwear)\b/i,
  },
  {
    service: "plastic manufacturer",
    pattern:
      /\b(plastics?|polymer|injection molding|blow molding|resin products?)\b/i,
  },
  {
    service: "automotive parts manufacturer",
    pattern:
      /\b(auto parts?|automotive parts?|aftermarket parts?|brake pads?|engine parts?)\b/i,
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
