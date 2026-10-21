import { z } from "zod";
export const capabilityDefinition = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/), title: z.string().trim().min(1).max(120),
  group: z.string().trim().min(1).max(80), mode: z.enum(["read", "approval"]),
  expectation: z.string().trim().min(1).max(700), test: z.string().trim().min(1).max(1000), examples: z.string().max(300),
}).strict();
export const capabilityResult = z.enum(["not_checked", "passed", "failed", "blocked", "not_applicable"]);
export const capabilityPath = z.object({
  kind: z.enum(["api", "browser", "knowledge", "other", "combined"]),
  discovery: z.string().trim().min(1).max(1000).describe("How Summer can discover this path"),
  location: z.string().trim().min(1).max(1000).describe("Guide, tool, API documentation or portal location; never a secret"),
}).strict();
const common = { id: capabilityDefinition.shape.id, expectedVersion: z.number().int().min(0) };
export const capabilityInput = z.discriminatedUnion("kind", [
  z.object({ ...common, kind: z.literal("definition"), definition: capabilityDefinition, notes: z.string().trim().min(1).max(2000) }).strict(),
  z.object({ ...common, kind: z.literal("review"), state: capabilityResult, notes: z.string().trim().min(1).max(2000), evidence: z.string().trim().max(2000) }).strict(),
  z.object({ ...common, kind: z.literal("agent"), caseId: z.string().uuid() }).strict(),
]);
