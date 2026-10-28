import { z } from "zod";
import type { Operation } from "./contract.ts";
import { scheduledJobSave, scheduledJobRequest } from "./schemas/scheduled-jobs.ts";
const params = z.object({ company: z.string().uuid(), environment: z.enum(["production", "staging"]) }).strict();
const job = params.extend({ job: z.string().uuid() }).strict();
const path = "/companies/{company}/environments/{environment}/scheduled-jobs";
const read = (id: string, suffix: string, summary: string): Operation => ({ id, method: "GET", path: path + suffix, scope: "cases.read", ownership: "environment", effect: "read", mcp: "full", release: "D", params, summary });
export const SCHEDULED_JOB_OPERATIONS: Operation[] = [
  read("scheduled_jobs.list", "", "Read company scheduled agent jobs, names, instructions, schedules, next runs and latest results. These independent jobs use company knowledge and connected tools; source collection precedes ordinary case routing."),
  { ...read("scheduled_jobs.save", "", "Create or update a scheduled native agent job at its expected revision. Configure its name, instructions, interval or five-field cron, IANA timezone and enabled state. Pausing stops an active run. Requires company admin and automation.manage; grants source reads and evidence capture, never customer effects."), method: "PUT", scope: "automation.manage", effect: "write", body: scheduledJobSave },
  { ...read("scheduled_jobs.run", "/{job}/run", "Request one run of an enabled scheduled job. Concurrent and repeated requests coalesce; reuse request_id on retry. The job's normal schedule remains in place."), method: "POST", scope: "automation.manage", effect: "request", params: job, body: scheduledJobRequest },
  { ...read("scheduled_jobs.runs", "/{job}/runs", "Read recent scheduled runs with original definition revisions, outcomes, coverage, saved source counts and failures."), params: job },
  { ...read("scheduled_jobs.history", "/{job}/history", "Read saved scheduled-job definition revisions and authenticated edit reasons."), params: job },
];
