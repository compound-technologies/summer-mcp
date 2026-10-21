import type { ApiError, Operation, Scope } from "./contract.ts";

/** Only the fields the transport needs. The host retains its full identity record. */
export type McpAdmission = {
  principal: { kind: "user" | "service" };
  grant: { id: string; scopes: Scope[]; companies: string[] };
};
/** Public configuration only. Never pass storage credentials or signing keys here. */
export type McpConfig = {
  enabled: boolean;
  apiOrigin: string;
  issuerOrigin: string;
  deploymentHost?: string;
  cliInstall?: string | null;
  setupAvailable: boolean;
};

/** Required host services. There is no permissive default backend. */
export type McpBackend<T extends McpAdmission> = {
  admit(request: Request, company: string | null): Promise<T>;
  authorize(admission: T, operation: Operation, args: Record<string, unknown>): void;
  execute(input: {
    admission: T; op: Operation; requestId: string;
    params: Record<string, unknown>; query: Record<string, unknown>; body: unknown;
    idempotencyKey: string | null;
  }): Promise<{ body: Record<string, unknown> }>;
  rateLimit(subject: string): Promise<{ allowed: boolean; retryAfter: number }>;
  clientAddress(request: Request): string;
  setupPrompt(context: { company?: string; environment: "staging" | "production" }): string;
  normalizeError(error: unknown): ApiError;
  isAuthenticationRequired(error: unknown): boolean;
  authenticateHeader(): string;
  errorResponse(error: ApiError, requestId: string): Response;
};
