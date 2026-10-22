// Shared public/UI input shapes. Business validators, membership and revision
// checks remain in the shared settings services and database functions.
import { z } from "zod";
const text = (label: string, max: number, required = true) => {
  const base = z.string().trim().max(max, `Keep ${label} under ${max.toLocaleString()} characters.`);
  return required ? base.min(1, `Add ${label}.`) : base;
};
const checkValue = z.enum(["pass", "fail", "unknown"]);
const scopeKeys = ["messages", "files", "cases", "approvals", "search", "jobs", "provider_copies", "knowledge", "settings"] as const;
export const policyInput = z.object({
  expectedRevision: z.number().int().min(0),
  calendar: z.object({ timezone: z.string().max(100), periods: z.array(z.object({ day: z.number().int().min(0).max(6), open: z.string().max(5), close: z.string().max(5) }).strict()).max(28), holidays: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), name: z.string().min(1).max(80) }).strict()).max(100) }).strict(),
  commitments: z.array(z.object({ kind: z.enum(["first_response", "next_response", "resolution"]), targetMinutes: z.number().positive().nullable() }).strict()).max(3),
  pauseOnCustomerWait: z.boolean(),
  effectiveAt: z.string().datetime({ offset: true }).nullable(),
  reason: z.string().trim().min(1, "Explain what changed.").max(500, "Keep the reason under 500 characters."),
}).strict();

export const savedReplyInput = z.object({
  id: z.string().uuid(),
  expectedRevision: z.number().int().min(0),
  name: z.string().trim().min(1, "Name the saved reply.").max(80, "Keep the name under 80 characters."),
  body: z.string().min(1, "Write the reply text.").max(4000, "Keep the reply under 4,000 characters."),
  retired: z.boolean(),
  reason: z.string().trim().min(1, "Explain the change.").max(300, "Keep the reason under 300 characters."),
}).strict();

export const scenarioInput = z.object({
  kind: z.literal("scenario"),
  id: z.string().uuid(),
  expectedRevision: z.number().int().min(0),
  retired: z.boolean(),
  reason: text("a reason", 300),
  fields: z.object({
    title: text("a title", 120),
    cohort: z.enum(["fixed", "held_out"]),
    difficulty: z.enum(["routine", "complex", "adversarial"]),
    sourceKind: z.enum(["historical", "synthetic"]),
    sourceCaseCode: text("the source case", 40, false),
    customerGoal: text("what the customer wanted", 2000),
    expectedFirstAction: text("the expected first action", 2000),
    remainingObligation: text("what remains owed", 2000, false),
    permittedEffects: text("permitted effects", 2000, false),
    prohibitedBehavior: text("prohibited behavior", 2000, false),
    closureEvidence: text("closure evidence", 2000),
  }),
}).strict();

export const assessmentInput = z.object({
  kind: z.literal("assessment"),
  id: z.string().uuid(),
  scenarioId: z.string().uuid(),
  runKind: z.enum(["live_case", "saved_run", "manual_walkthrough"]),
  runReference: text("a run reference", 120, false),
  outcome: z.enum(["verified_complete", "still_open", "blocked", "unsafe", "unknown"]),
  checks: z.object({ original_evidence: checkValue, customer_outcome: checkValue, safe_exact_action: checkValue, clarity: checkValue, follow_through: checkValue }),
  notes: text("what the original evidence showed", 4000),
  corrects: z.string().uuid().nullable(),
}).strict();

export const privacyRequestInput = z.object({
  kind: z.literal("request"), id: z.string().uuid(), requestKind: z.enum(["export", "deletion"]), subjectKind: z.enum(["company", "customer", "staff"]),
  subjectLabel: text("who the request is about", 160), scope: z.array(z.enum(scopeKeys)).min(1, "Choose at least one area.").max(scopeKeys.length),
  reason: text("the reason and how the requester was verified", 1000),
}).strict();

export const viewSaveInput = z.object({ kind: z.literal("save"), id: z.string().uuid(), name: text("a name", 60), query: z.string().max(500), shared: z.boolean() }).strict();

export const viewDeleteInput = z.object({ kind: z.literal("delete"), id: z.string().uuid() }).strict();
