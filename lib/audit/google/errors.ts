export class AuditDataError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean,
  ) {
    super(message);
    this.name = "AuditDataError";
  }
}

export class InvalidBusinessReferenceError extends AuditDataError {
  constructor() {
    super("Provide placeId or textQuery", "INVALID_REF", false);
    this.name = "InvalidBusinessReferenceError";
  }
}

export class BusinessNotFoundError extends AuditDataError {
  constructor(query: string) {
    super(`No business found for "${query}"`, "NOT_FOUND", false);
    this.name = "BusinessNotFoundError";
  }
}

export class BusinessHasNoReviewsError extends AuditDataError {
  constructor(placeId: string) {
    super(
      `Business ${placeId} has zero reviews — audit not meaningful`,
      "NO_REVIEWS",
      false,
    );
    this.name = "BusinessHasNoReviewsError";
  }
}

export class GoogleApiError extends AuditDataError {
  constructor(status: string, message: string) {
    super(
      `Google API error: ${status} — ${message}`,
      "GOOGLE_API",
      status === "OVER_QUERY_LIMIT" || status === "UNKNOWN_ERROR",
    );
    this.name = "GoogleApiError";
  }
}

export class OutscraperError extends AuditDataError {
  constructor(message: string) {
    super(`Outscraper failure: ${message}`, "OUTSCRAPER", true);
    this.name = "OutscraperError";
  }
}

export class CacheError extends AuditDataError {
  constructor(message: string) {
    super(`Cache error: ${message}`, "CACHE", true);
    this.name = "CacheError";
  }
}
