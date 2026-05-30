import type { AuditScore, ComponentKey } from "./types";

export function findWeakestComponent(
  components: AuditScore["components"],
): ComponentKey {
  const entries = Object.entries(components) as Array<
    [ComponentKey, AuditScore["components"][ComponentKey]]
  >;

  let weakest: ComponentKey = entries[0][0];
  let min = entries[0][1].raw_score;

  for (const [key, comp] of entries) {
    if (comp.raw_score < min) {
      min = comp.raw_score;
      weakest = key;
    }
  }

  return weakest;
}
