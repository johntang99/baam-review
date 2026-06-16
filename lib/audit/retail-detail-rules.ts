type RetailRule = {
  service: string;
  pattern: RegExp;
  score: number;
};

const RETAIL_SIGNAL_PATTERN =
  /\b(rug|rugs|carpet|carpets|oriental|persian|showroom|gallery)\b/i;

const RETAIL_DETAIL_RULES: readonly RetailRule[] = [
  {
    service: "oriental rug store",
    pattern: /\b(oriental|persian)\s*(rugs?|carpets?)\b/i,
    score: 3,
  },
  {
    service: "oriental rug store",
    pattern:
      /\b(area\s*rugs?|rugs?|carpets?)\s*(store|shop|gallery|showroom|boutique)\b/i,
    score: 2,
  },
  {
    service: "oriental rug store",
    pattern: /\b(handmade|traditional|contemporary)\s*(rugs?|carpets?)\b/i,
    score: 2,
  },
  {
    service: "carpet cleaning service",
    pattern: /\b(rug|carpet)\s*clean(ing|er|ers)?\b/i,
    score: 2,
  },
  {
    service: "carpet repair service",
    pattern: /\b(rug|carpet)\s*repair(s|ing)?\b/i,
    score: 2,
  },
  {
    service: "carpet repair service",
    pattern:
      /\b((rug|carpet)\s*(reweav(e|ing)|fringe|binding|restoration)|fringe\s*repair)\b/i,
    score: 1,
  },
];

const SERVICE_PRIORITY: readonly string[] = [
  "oriental rug store",
  "carpet cleaning service",
  "carpet repair service",
];

export function hasRetailSignalText(text: string | null | undefined) {
  if (!text) return false;
  return RETAIL_SIGNAL_PATTERN.test(text);
}

export function inferDetailedRetailService({
  text,
  hasRetailSignal,
}: {
  text: string | null | undefined;
  hasRetailSignal: boolean;
}) {
  if (!text || !hasRetailSignal) return "";

  const scoreByService = new Map<string, number>();
  for (const rule of RETAIL_DETAIL_RULES) {
    if (!rule.pattern.test(text)) continue;
    scoreByService.set(rule.service, (scoreByService.get(rule.service) ?? 0) + rule.score);
  }
  if (scoreByService.size === 0) return "";

  return Array.from(scoreByService.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return SERVICE_PRIORITY.indexOf(a[0]) - SERVICE_PRIORITY.indexOf(b[0]);
    })[0][0];
}
