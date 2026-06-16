type VisionDetailRule = {
  service: string;
  pattern: RegExp;
};

const VISION_DETAIL_RULES: readonly VisionDetailRule[] = [
  {
    service: "ophthalmology clinic",
    pattern:
      /\b(ophthalm\w*|retina specialist|cataract( surgery)?|lasik( surgeon)?|glaucoma specialist)\b/i,
  },
  {
    service: "optometry clinic",
    pattern:
      /\b(optometr(y|ist)|eye exams?|eye care|eye\s*&?\s*vision|vision care|vision center|myopia control)\b/i,
  },
  {
    service: "optician",
    pattern:
      /\b(optician|optical|optical dispensary|lens fitting|contact lenses?|prescription lenses?)\b/i,
  },
  {
    service: "eyewear store",
    pattern:
      /\b(eyewear|eyeglasses?|glasses|spectacles|frames|sunglasses)\b/i,
  },
];

const VISION_SIGNAL_PATTERN =
  /\b(eye|vision|optical|optometr\w*|optician\w*|eyewear|glasses|ophthalm\w*)\b/i;

export function hasVisionSignalText(text: string | null | undefined) {
  if (!text) return false;
  return VISION_SIGNAL_PATTERN.test(text);
}

export function inferDetailedVisionService({
  text,
  hasVisionSignal,
}: {
  text: string | null | undefined;
  hasVisionSignal: boolean;
}) {
  if (!text || !hasVisionSignal) return "";
  for (const rule of VISION_DETAIL_RULES) {
    if (rule.pattern.test(text)) return rule.service;
  }
  return "";
}
