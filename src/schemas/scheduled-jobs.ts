import { z } from "zod";

export const scheduledJobSchedule = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("interval"), seconds: z.number().int().min(60).max(604800) }).strict(),
  z.object({ kind: z.literal("cron"), expression: z.string().trim().min(9).max(120) }).strict(),
]);
export const scheduledJobSave = z.object({
  id: z.string().uuid(), expected_revision: z.number().int().nonnegative(),
  name: z.string().trim().min(1).max(100), instructions: z.string().trim().min(1).max(16000),
  schedule: scheduledJobSchedule, timezone: z.string().min(1).max(100), enabled: z.boolean(),
  reason: z.string().trim().min(1).max(1000),
}).strict();
export const scheduledJobRequest = z.object({ request_id: z.string().uuid(), expected_revision: z.number().int().positive() }).strict();
export type ScheduledJobInput = z.infer<typeof scheduledJobSave>;
export type ScheduledJob = Omit<ScheduledJobInput, "expected_revision" | "reason"> & {
  revision: number; next_run_at: string; updated_at: string; updated_by: string;
  last_status: string | null; last_summary: string | null; last_started_at: string | null; last_finished_at: string | null;
};
export type ScheduledRun = {
  id: string; job_id: string; company_id: string; environment: "production" | "staging";
  revision: number; definition: ScheduledJobInput; status: "preparing" | "running" | "completing" | "completed" | "failed" | "cancelled";
  lease_id: string; deadline_at: string; started_at: string; finished_at: string | null;
  sandbox_name: string | null; sandbox_id: string | null; command_id: string | null;
  stop_requested_at: string | null; summary: string | null; coverage: string | null; error_code: string | null;
  checkpoint: Record<string, unknown>; conversation_count: number; message_count: number;
  deployment_id: string | null; next_occurrence: string;
  snapshot_id?: string | null;
};
