import { z } from "zod";
import { prepareTeachingInput, saveTeachingInput } from "./schemas/case-teaching.ts";
const params = z.object({ company: z.string().uuid(), environment: z.enum(["production", "staging"]), case: z.string().uuid() }).strict();
export const CASE_TEACHING_OPERATIONS = [
  { id: "cases.teaching.prepare", method: "POST", path: "/companies/{company}/environments/{environment}/cases/{case}/teaching/prepare", scope: "setup", ownership: "environment", effect: "request", mcp: "full", release: "C",
    summary: "Prepare reusable company knowledge from an operator correction or human reply and a fast reply draft from the saved conversation. Also requires cases.read. Saves and sends nothing; no investigation is queued.", params, body: prepareTeachingInput },
  { id: "cases.teaching.save", method: "POST", path: "/companies/{company}/environments/{environment}/cases/{case}/teaching/save", scope: "setup", ownership: "environment", effect: "write", mcp: "full", release: "C",
    summary: "Save the exact reviewed reusable fact in shared company core guidance at the expected revision, with original operator text and case provenance. Also requires cases.read and current company and Ops admin rights. Does not send the reply or restart an agent.", params, body: saveTeachingInput },
] as const;
