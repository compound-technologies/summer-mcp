import { z } from "zod";

const text = z.string().max(240).regex(/^[^\u0000-\u001f\u007f]*$/);
/** Browser-supplied page evidence, never identity or authority to act. */
export const messengerPageContextSchema = z.object({
 version: z.literal(1),
 url: z.string().max(2048).refine(value => {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && value === url.origin + url.pathname; }
  catch { return false; }
 }, "Send only the current page origin and path, without query parameters or fragments."),
 title: text, captured_at: z.iso.datetime(), headings: z.array(text).max(40), descriptions: z.array(text).max(30),
 controls: z.array(z.object({ label: text, kind: z.string().max(40), section: text.optional(), disabled: z.boolean(), checked: z.boolean().optional(), selected: z.boolean().optional(), value: text.optional() }).strict()).max(80),
}).strict();
export type MessengerPageContext = z.infer<typeof messengerPageContextSchema>;
