import { z } from "zod";

export const proposalActionId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
const scope = z.string().trim().min(1).max(200);
const permission = { mode: z.enum(["review", "automatic"]), threshold: z.number().int().min(0).max(100) };
/**
 * Planned-action families. The server names each action's family from its
 * action ID. A family rule with mode "review" holds every action in the family
 * whatever the other rules say: the family's kill switch.
 */
export const ACTION_FAMILY_IDS = ["reply", "closure", "record", "vendor_contact", "clinician_note", "address_cancel", "money"] as const;
export type ActionFamily = (typeof ACTION_FAMILY_IDS)[number];
const family = z.enum(ACTION_FAMILY_IDS);
/** Whole cents, up to $10,000, matching summer_execution_policy_valid. */
const cents = z.number().int().min(0).max(1_000_000);
export const executionPolicySchema = z.object({
  default: z.object(permission).strict(),
  exceptions: z.array(z.object({
    id: proposalActionId,
    audience: z.enum(["internal", "partner", "customer"]).optional(),
    channel: z.enum(["chat", "email", "sms", "slack", "voice"]).optional(),
    connection: scope.optional(), destination: scope.optional(), capability: scope.optional(),
    family: family.optional().describe("An action family: reply, closure, record, vendor_contact, clinician_note, address_cancel or money. With mode review, the rule holds every action in the family (a kill switch). An automatic family rule does not lift the Slack hold unless it also names the slack channel."),
    ...permission,
  }).strict().refine(rule => Boolean(rule.audience || rule.channel || rule.connection || rule.destination || rule.capability || rule.family), "Choose at least one scope."))
    .max(12).refine(rules => new Set(rules.map(rule => rule.id)).size === rules.length, "Exception IDs must be unique."),
  /** Run the leading steps that qualify and leave the rest with a person. Off when omitted. */
  partial: z.boolean().optional().describe("When true, auto-run may run the leading steps of a plan that qualify and leave the remaining steps, and every case closure, waiting for a person. Off when omitted."),
  /** Money auto-run may move, in whole cents. Omitted: DEFAULT_MONEY_LIMITS. */
  money: z.object({
    refundCentsMax: cents.optional().describe("Largest single refund that may run automatically. Omitted: refunds wait for a person."),
    creditCentsMax: cents.optional().describe("Largest single account credit that may run automatically. Omitted: credits wait for a person."),
    dailyCentsMax: cents.describe("Most refunds and credits that auto-run may approve in any 24 hours, across the company and environment."),
  }).strict().optional().describe("Money limits for auto-run, in whole cents. Omitted: a refund up to 20000 ($200), a credit up to 10000 ($100) and 50000 ($500) in any 24 hours. Set the limits to 0 to make all money wait for a person. Charges and promotions always wait for a person."),
}).strict();
export type ExecutionPolicy = z.infer<typeof executionPolicySchema>;
export type MoneyLimits = NonNullable<ExecutionPolicy["money"]>;
/**
 * The limits a policy uses when it sets no money (Nick, 2026-10-28). The
 * database uses the same values (summer_policy_money).
 */
export const DEFAULT_MONEY_LIMITS: MoneyLimits = { refundCentsMax: 20_000, creditCentsMax: 10_000, dailyCentsMax: 50_000 };
/** The money limits a saved policy uses: its own, or the defaults when it sets none. */
export const policyMoneyLimits = (policy: Pick<ExecutionPolicy, "money">): MoneyLimits => policy.money ?? DEFAULT_MONEY_LIMITS;
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

/** Draft one family's policy change from the calibration report. Previews only. */
export const familyPolicyPreviewBody = z.object({
  family: family.describe("The action family to change."),
  change: z.enum(["widen", "hold"]).default("widen").describe("widen adds an automatic rule for a family the calibration report marks ready_to_widen. hold adds the family's kill switch: a review rule with threshold 100. Either way nothing is saved."),
  threshold: z.number().int().min(0).max(100).optional().describe("For widen: the confidence each action in the family needs. Default: the policy's default threshold."),
}).strict();
