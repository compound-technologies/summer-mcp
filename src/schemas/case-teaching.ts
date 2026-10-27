import { z } from "zod";

export const teachingSource = z.enum(["correction", "reply"]);
export const prepareTeachingInput = z.object({
  source: teachingSource,
  text: z.string().trim().min(1).max(12000),
}).strict();
export const saveTeachingInput = prepareTeachingInput.extend({
  revision: z.number().int().positive(),
  title: z.string().trim().min(1).max(160).refine(value => !/[\r\n]/.test(value), "Use one line."),
  knowledge: z.string().trim().min(1).max(12000),
  replaces: z.string().min(1).max(20000).nullable().default(null),
}).strict();
export const teachingRequest = z.discriminatedUnion("action", [
  prepareTeachingInput.extend({ action: z.literal("prepare") }),
  saveTeachingInput.extend({ action: z.literal("save") }),
]);
export type TeachingPreview = {
  revision: number; replaces: string | null; title: string; knowledge: string | null; reply: string | null; explanation: string;
};
