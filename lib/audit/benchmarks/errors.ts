import { AuditDataError } from "../google/errors";

export class BenchmarkNotFoundError extends AuditDataError {
  constructor(vertical: string, region: string) {
    super(
      `No active benchmark found for vertical='${vertical}' region='${region}' (and no 'national' fallback)`,
      "BENCHMARK_NOT_FOUND",
      false,
    );
    this.name = "BenchmarkNotFoundError";
  }
}
