/**
 * Strongly typed API error handling
 * Replaces the generic `any` type patterns used throughout the app
 */

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiErrorResponse {
  error?: string;
  message?: string;
  details?: unknown;
}

/**
 * Type-safe API response handling
 */
export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiErrorResponse;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    throw new ApiError(
      response.status,
      errorData.error || errorData.message || response.statusText,
      errorData.details
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Type-safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unexpected error occurred";
}

/**
 * Type-safe validation helper
 */
export function isValidResponse<T>(
  data: unknown,
  requiredFields: (keyof T)[] = []
): data is T {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  return requiredFields.every((field) => field in data);
}

/**
 * Safe property access with fallback
 */
export function safeGet<T>(obj: unknown, path: string, defaultValue: T): T {
  try {
    const value = path
      .split(".")
      .reduce((current: any, prop) => current?.[prop], obj);

    return value !== undefined ? value : defaultValue;
  } catch {
    return defaultValue;
  }
}
