import { z } from "zod";
export const PHONE_CALL_TYPES = [
  "general",
  "existing_customer",
  "new_customer",
  "pharmacy",
] as const;
export const PHONE_CALL_LABELS: Record<
  (typeof PHONE_CALL_TYPES)[number],
  string
> = {
  general: "General",
  existing_customer: "Existing customer",
  new_customer: "New customer",
  pharmacy: "Pharmacy",
};
const callType = z.enum(PHONE_CALL_TYPES);
const number = z
  .object({
    id: z.string().regex(/^PN[A-Za-z0-9_-]{1,98}$/),
    name: z.string().trim().min(1).max(80),
    number: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
    note: z.string().trim().max(1000).default(""),
    defaultType: callType.nullable(),
  })
  .strict();
export const phoneSettingsInput = z
  .object({
    line_id: z.string().uuid(),
    version: z.number().int().min(1),
    enabled: z.boolean(),
    numbers: z.array(number).max(20),
    menu: z.record(z.string().regex(/^[0-9*#]$/), callType),
    /** Where "a person, please" transfers the caller. Omit to keep the saved
     * number; null turns transfers off. */
    transfer_e164: z
      .string()
      .regex(/^\+[1-9][0-9]{7,14}$/)
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (new Set(input.numbers.map((n) => n.id)).size !== input.numbers.length)
      ctx.addIssue({
        code: "custom",
        path: ["numbers"],
        message: "Choose each Quo number once.",
      });
    if (
      input.transfer_e164 &&
      input.numbers.some((n) => n.number === input.transfer_e164)
    )
      ctx.addIssue({
        code: "custom",
        path: ["transfer_e164"],
        message:
          "Transfer to a number that rings people, not a Quo number that forwards to Summer.",
      });
  });
export type PhoneSettingsInput = z.infer<typeof phoneSettingsInput>;
export type PhoneSettingsView = {
  lines: Array<{
    id: string;
    phone_e164: string;
    enabled: boolean;
    version: number;
    installation_id: string;
    updated_at: string;
    numbers: PhoneSettingsInput["numbers"];
    menu: PhoneSettingsInput["menu"];
    transfer_e164: string | null;
  }>;
  calls: Array<{
    id: string;
    at: string;
    status: string;
    caller: string | null;
    line: string;
    source: string | null;
    digit: string | null;
    type: string | null;
    seconds: number | null;
    caseId: string | null;
    reason: string | null;
  }>;
  history: Array<{
    id: string;
    line_id: string;
    version: number;
    actor: string;
    created_at: string;
  }>;
  last_event_at: string | null;
  webhook_key_saved: boolean;
  observed_at: string;
};
