import { z } from "zod";

/** Row ids from reports.delivery: `operator:<uuid>` or `agent:<uuid>`. */
export const deliveryAttemptId = z.string().regex(/^(operator|agent):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const DELIVERY_BULK_ACTIONS = ["request_plan", "approve_and_run", "run_again"] as const;
export const DELIVERY_BULK_LIMIT = 50;

export const deliveryBulkInput = z.object({
  action: z.enum(DELIVERY_BULK_ACTIONS).describe("request_plan asks the agent for a new plan. approve_and_run approves each case's current saved plan, bound to its exact prepared changes, then runs it. run_again starts an approved plan that is waiting to start."),
  attempts: z.array(deliveryAttemptId).min(1).max(DELIVERY_BULK_LIMIT)
    .refine(ids => new Set(ids).size === ids.length, "Choose each row once")
    .describe("Row ids from reports.delivery."),
  authorization: z.string().trim().min(1).max(2000).optional()
    .describe("The operator's instruction for this work, kept with each approval. Needed for approve_and_run and run_again. This is context, not an identity attestation."),
}).strict().superRefine((input, ctx) => {
  if (input.action !== "request_plan" && !input.authorization)
    ctx.addIssue({ code: "custom", path: ["authorization"], message: "Say what the operator asked for" });
});
export type DeliveryBulkInput = z.infer<typeof deliveryBulkInput>;
