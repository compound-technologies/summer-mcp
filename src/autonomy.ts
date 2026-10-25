import { z } from "zod";

export const proposalActionId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
const scope = z.string().trim().min(1).max(200);
const permission = { mode: z.enum(["review", "automatic"]), threshold: z.number().int().min(0).max(100) };
export const executionPolicySchema = z.object({
  default: z.object(permission).strict(),
  exceptions: z.array(z.object({
    id: proposalActionId,
    audience: z.enum(["internal", "partner", "customer"]).optional(),
    channel: z.enum(["chat", "email", "sms", "slack", "voice"]).optional(),
    connection: scope.optional(), destination: scope.optional(), capability: scope.optional(),
    ...permission,
  }).strict().refine(rule => Boolean(rule.audience || rule.channel || rule.connection || rule.destination || rule.capability), "Choose at least one scope."))
    .max(12).refine(rules => new Set(rules.map(rule => rule.id)).size === rules.length, "Exception IDs must be unique."),
}).strict();
export type ExecutionPolicy = z.infer<typeof executionPolicySchema>;
export const REVIEW_POLICY: ExecutionPolicy = { default: { mode: "review", threshold: 95 }, exceptions: [] };

/** Produced by trusted action preparation, never accepted from a plan or model. */
export const actionBindingSchema = z.object({
  capability: scope,
  channel: scope.nullable(),
  connection: scope,
  destinations: z.array(scope).min(1).max(20),
  audiences: z.array(z.enum(["internal", "partner", "customer", "unknown"])).max(3),
  supported: z.boolean(),
}).strict();
export type ActionBinding = z.infer<typeof actionBindingSchema>;

export const executionPolicySaveBody = z.object({ version: z.number().int().min(0), settings: executionPolicySchema }).strict();
