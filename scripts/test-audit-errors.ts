import {
  getGoogleBusinessData,
  InvalidBusinessReferenceError,
  BusinessNotFoundError,
} from "@/lib/audit/google";

async function expectThrow<E extends Error>(
  label: string,
  ctor: new (...args: never[]) => E,
  fn: () => Promise<unknown>,
) {
  try {
    await fn();
    console.log(`FAIL ${label}: did not throw`);
  } catch (err) {
    if (err instanceof ctor) {
      console.log(`PASS ${label}: ${err.constructor.name} — ${err.message}`);
    } else {
      console.log(`FAIL ${label}: threw ${(err as Error).constructor.name} (expected ${ctor.name}) — ${(err as Error).message}`);
    }
  }
}

async function main() {
  await expectThrow(
    "invalid input (neither placeId nor textQuery)",
    InvalidBusinessReferenceError,
    () => getGoogleBusinessData({}, "free"),
  );

  await expectThrow(
    "business not found by text query",
    BusinessNotFoundError,
    () => getGoogleBusinessData({ textQuery: "zzqxqxqxnonsenseasdfasdf12345" }, "free"),
  );
}

main().catch((err) => {
  console.error("script crash:", err);
  process.exit(1);
});
