import { z } from "zod";

export const ticketActivityQuery = z.object({
  period: z.enum(["1d", "7d", "30d", "all"]).default("30d")
    .describe("Company-local calendar days including today. 1d is hourly today; all includes full recorded history, grouped monthly after 120 days."),
}).strict();
