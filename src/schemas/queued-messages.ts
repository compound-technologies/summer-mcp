import { z } from "zod";

/** Shared UI, API, CLI and MCP filters for the original outgoing queues. */
export const queuedMessagesQuery = z.object({
  channel: z.enum(["email", "slack", "sms", "chat"]).optional(),
  offset: z.coerce.number().int().min(0).max(1000000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();
