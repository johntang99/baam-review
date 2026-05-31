import { getGoogleBusinessData } from "@/lib/audit/google";
import { resolveServiceKeyword } from "@/lib/audit/competitors/keyword-resolver";

(async () => {
  const queries = [
    "Wedding Atelier Flagship Bridal Boutique Madison Ave New York",
    "Joe's Shanghai 46 Bowery New York",
    "Datang Moxibustion 36-28A Union St Flushing NY",
    "Bill Jiao Acupuncture 142-19 38th Ave Flushing NY",
  ];

  for (const q of queries) {
    try {
      const g = await getGoogleBusinessData({ textQuery: q }, "free");
      const service = resolveServiceKeyword(g);
      console.log(
        `${g.business.name.padEnd(50).slice(0, 50)}  vertical=${g.vertical.inferred_vertical.padEnd(18)}  service="${service}"`,
      );
    } catch (err) {
      console.log(`${q}: ${(err as Error).message}`);
    }
  }
})();
