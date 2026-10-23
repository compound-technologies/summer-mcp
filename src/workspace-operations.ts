import { serviceSampleQuery } from "./schemas/service-samples.ts";
import { workflowSaveInput,workflowRequestInput } from "./schemas/workflows.ts";
// Public workspace operations; transport/authentication stay in the shared catalog.
import { z } from "zod";
import type { Operation } from "./contract.ts";
import { policyInput, savedReplyInput, scenarioInput, assessmentInput, privacyRequestInput, viewSaveInput, viewDeleteInput } from "./schemas/workspace.ts";
import {themePeriodInput,themeReviewInput} from "./schemas/support-themes.ts";
const uuid = z.string().uuid();
const company = z.object({ company: uuid }).strict();
const environment = company.extend({ environment: z.enum(["staging", "production"]) }).strict();
const companyPath = "/companies/{company}";
const environmentPath = `${companyPath}/environments/{environment}`;
const yesNo = z.union([z.boolean(), z.enum(["true", "false"])]);
const page = z.string().regex(/^[1-9]\d{0,5}$/);
export const caseListQuery = z.object({
  cursor: page.optional(), limit: z.coerce.number().int().min(1).max(200).optional(),
  sentiment: z.enum(["happy","neutral","upset","angry","sad","mixed","unknown"]).optional(),
  status: z.enum(["open", "in_progress", "resolved", "closed", "active", "all"]).optional(),
  sort: z.enum(["priority", "newest", "oldest", "due", "activity", "autonomy_desc", "autonomy_asc"]).optional(),
  severity: z.enum(["normal", "high", "urgent"]).optional(), category: z.string().max(80).optional(), language: z.enum(["en", "es", "other"]).optional(),
  workstream: z.string().max(80).optional(), lane: z.enum(["all", "customer_request", "proactive_issue", "source_review"]).optional(),
  plan: z.enum(["all", "ready"]).optional(), autonomy: z.string().max(40).optional(),
  mine: yesNo.optional(), reviewMine: yesNo.optional(), responseDue: yesNo.optional(), pastSla: yesNo.optional(), followUps: yesNo.optional(),
  escalations: yesNo.optional(), unmatched: yesNo.optional(), dismissals: yesNo.optional(), internal: yesNo.optional(), sandbox: yesNo.optional(),
}).strict();
const mode = z.enum(["off", "default", "round_robin"]);
const pool = z.array(uuid).max(100).refine(ids => new Set(ids).size === ids.length, "Choose each teammate once.");
export const routingSettingsSchema = z.object({ version: z.number().int().min(0), issue_mode: mode, review_mode: mode, issue_members: pool, review_members: pool }).strict().superRefine((input, ctx) => {
  for (const kind of ["issue", "review"] as const) if (input[`${kind}_mode`] === "default" && input[`${kind}_members`].length !== 1)
    ctx.addIssue({ code: "custom", path: [`${kind}_members`], message: "Choose the routing team." });
});
const read = (id: string, path: string, summary: string, params: Operation["params"] = company, scope: "setup" | "cases.read" = "setup"): Operation =>
  ({ id, path, summary, params, scope, method: "GET", ownership: "company", effect: "read", mcp: "full", release: "D" });
const write = (id: string, path: string, summary: string, body: z.ZodType): Operation =>
  ({ id, path, summary, body, params: company, scope: "setup", method: "PUT", ownership: "company", effect: "write", mcp: "full", release: "D" });
const envRead = (id: string, path: string, summary: string): Operation =>
  ({ ...read(id, `${environmentPath}${path}`, summary, environment, "cases.read"), params: environment, ownership: "environment" });
export const WORKSPACE_OPERATIONS: Operation[] = [
  {...envRead("reports.themes.get","/reports/themes/{report}","Read one saved recurring-issue report and its source snapshot, including reports older than the latest list. Requires current operational company access."),params:environment.extend({report:uuid}).strict()},
  envRead("reports.themes.list","/reports/themes","Read the latest private recurring-issue reports, original case references, source coverage, generation status and human review. Generated themes are suggestions, not verified causes."),
  {...envRead("reports.themes.generate","/reports/themes","Generate a private recurring-issue report from the admitted case-summary cohort. One immutable request ID prevents duplicate inference. No customer, knowledge or publication effect."),method:"POST",effect:"request",scope:"investigations.request",body:themePeriodInput},
  {...envRead("reports.themes.review","/reports/themes/{report}/review","Record a human disposition on a saved recurring-issue theme at its expected revision. Retains the original analysis and source references; does not change cases or company knowledge."),method:"POST",effect:"write",scope:"workspace.write",params:environment.extend({report:uuid}).strict(),body:themeReviewInput},

  {...envRead("workflows.list","/workflows","Read built-in tasks and company/environment-owned workflow templates. Selecting one never runs work."),query:z.object({retired:yesNo.optional()}).strict()},
  {...envRead("workflows.history","/workflows/{workflow}/history","Read the original revisions and authenticated edits for a saved workflow."),params:environment.extend({workflow:uuid}).strict()},
  {...write("workflows.save",`${environmentPath}/workflows`,"Save, retire or restore a task template with its expected revision. Changes no case or effect authority.",workflowSaveInput),params:environment,ownership:"environment",scope:"workspace.write"},
  {...envRead("workflows.request_text","/workflows/request-text","Prepare editable operator guidance from an exact active workflow revision and feedback. Starts no investigation and executes no action."),method:"POST",body:workflowRequestInput},
  { ...read("support.policy.read", `${companyPath}/support-policy`, "Read business hours, holidays, response commitments and scheduled policy revisions."), scope: "cases.read", alsoScope: "setup" },
  write("support.policy.update", `${companyPath}/support-policy`, "Save business hours and response commitments with the expected revision and an effective date.", policyInput),
  { ...read("saved_replies.list", `${companyPath}/saved-replies`, "Read company saved replies, optionally including retired replies."), scope: "cases.read", alsoScope: "setup", query: z.object({ retired: yesNo.optional() }).strict() },
  write("saved_replies.save", `${companyPath}/saved-replies`, "Create, edit, retire or restore a saved reply with its expected revision and reason. Sends nothing. API reference: https://api.gosummer.ai/v1/openapi.json", savedReplyInput),
  { ...read("saved_replies.history", `${companyPath}/saved-replies/{reply}/history`, "Read original revisions of a saved reply."), params: company.extend({ reply: uuid }).strict(), scope: "cases.read", alsoScope: "setup" },
  { ...read("saved_views.list", `${companyPath}/saved-views`, "Read this person's saved inbox views and shared company views.", company, "cases.read"), alsoScope: "setup" },
  { ...write("saved_views.save", `${companyPath}/saved-views`, "Save a personal or shared inbox view. Known case filters are normalized by the same service as the UI.", viewSaveInput), scope: "workspace.write", alsoScope: "setup" },
  { ...write("saved_views.delete", `${companyPath}/saved-views/delete`, "Remove an owned inbox view, retaining the database's ownership checks.", viewDeleteInput), method: "POST", scope: "workspace.write", alsoScope: "setup" },
  { ...read("quality.scenarios.list", `${companyPath}/quality/scenarios`, "Read quality scenarios, assessments and current outcomes."), scope: "cases.read", alsoScope: "setup" },
  { ...read("quality.scenarios.get", `${companyPath}/quality/scenarios/{scenario}`, "Read one scenario and its saved assessments."), params: company.extend({ scenario: uuid }).strict(), scope: "cases.read", alsoScope: "setup" },
  write("quality.scenarios.save", `${companyPath}/quality/scenarios`, "Create, revise or retire a quality scenario, with expected revision and reason.", scenarioInput),
  { ...write("quality.assessments.save", `${companyPath}/quality/assessments`, "Record an evidence-backed assessment or correction. Does not approve a plan or customer action.", assessmentInput), method: "POST", scope: "workspace.write", alsoScope: "setup" },
  { ...read("quality.corrections.list", `${companyPath}/quality/corrections`, "Read evidence-backed corrections to previous quality assessments."), scope: "cases.read", alsoScope: "setup" },
  read("privacy.requests.list", `${companyPath}/privacy/requests`, "Read privacy export/deletion requests, status and original event history. Does not export or delete data."),
  { ...write("privacy.requests.create", `${companyPath}/privacy/requests`, "File an export or deletion request for human review. Cannot approve, perform or attest completion of the work.", privacyRequestInput), method: "POST", effect: "request" },
  read("work_routing.read", `${companyPath}/work-routing`, "Read eligible teammates and automatic owner/reviewer routing settings."),
  write("work_routing.update", `${companyPath}/work-routing`, "Save automatic owner/reviewer routing with the expected version. Does not grant roles or approval authority.", routingSettingsSchema),
  { ...envRead("cases.engineering.list", "/cases/{case}/engineering", "Read private engineering issue associations, optionally checking original GitHub state. Does not close cases or send replies."),params:environment.extend({case:uuid}).strict(),query:z.object({refresh:yesNo.optional()}).strict()},
  { ...envRead("cases.assignment.read", "/cases/{case}/assignment", "Read a case's issue owner, plan reviewer and eligible teammates."), params: environment.extend({ case: uuid }).strict() },
  { ...write("cases.assignment.update", `${environmentPath}/cases/{case}/assignment`, "Assign an issue owner or plan reviewer with the previous owner as a conflict check. Does not grant roles or approve a plan.", z.object({ requestId: uuid.nullable(), memberId: uuid.nullable(), previous: uuid.nullable() }).strict()), params: environment.extend({ case: uuid }).strict(), ownership: "environment", scope: "workspace.write", alsoScope: "setup" },
  envRead("reports.credits", "/reports/credits", "Read all-time and month-to-date credits, pending reservations and monthly usage in the company timezone."),
  { ...envRead("reports.samples.list", "/reports/samples", "Read paginated original issue/message references behind service counts and timing samples, with date/channel/hour filters in the company timezone. No messages are sent or marked read."), query:serviceSampleQuery },
  envRead("reports.service_metrics", "/reports/service-metrics", "Read response and resolution metrics, 90-day daily issue/message and timing trends, and weekday/hour incoming-message heatmaps in the company timezone. Missing timings stay unmeasured."),
  envRead("reports.delivery", "/reports/delivery", "Read delivery attempts, failures and recorded results. Does not retry a delivery."),
  envRead("reports.commitments", "/reports/commitments", "Read outstanding customer promises and unfinished work."),
  { ...envRead("human_tasks.list", "/human-tasks", "Read work that Summer agents or blocked approvals asked a person to do, with owners, due times, recorded outcomes and change history for one selected task."), query: z.object({
    status: z.enum(["open", "done", "dismissed", "all"]).optional(), mine: yesNo.optional(), case: uuid.optional(), task: uuid.optional(),
  }).strict() },
  { ...write("human_tasks.update", `${environmentPath}/human-tasks`, "Complete, dismiss, reopen or assign a human task with its expected version. Records the person and outcome. Does not approve a plan or change customer records.", z.object({
    taskId: uuid, version: z.number().int().min(1), operation: z.enum(["complete", "dismiss", "reopen", "assign"]),
    outcome: z.string().trim().max(1000).optional(), assigneeId: uuid.nullable().optional(),
  }).strict().superRefine((input, ctx) => {
    if (input.operation === "dismiss" && !input.outcome) ctx.addIssue({ code: "custom", path: ["outcome"], message: "Say why the task is not needed." });
    if (input.operation === "assign" && input.assigneeId === undefined) ctx.addIssue({ code: "custom", path: ["assigneeId"], message: "Choose a teammate, or null to clear the owner." });
  })), method: "POST", params: environment, ownership: "environment", scope: "workspace.write", alsoScope: "setup" },
  envRead("agent_exclusions.list", "/agent-exclusions", "Read the company's sender exclusions and original edit history. Changes retain human approval."),
  { ...envRead("messenger.conversations.list", "/messenger/conversations", "Search and filter the complete Messenger inbox, including visitor conversations without Ops cases."), query: z.object({
    cursor: page.optional(), limit: z.coerce.number().int().min(1).max(200).optional(), q: z.string().max(200).optional(),
    sort: z.enum(["waiting", "activity", "overdue", "newest"]).optional(),
    filter: z.enum(["open", "needs_human", "plan_ready", "agent_working", "waiting_customer", "resolved", "all"]).optional(),
    conversation: uuid.optional(),
  }).strict() },
  { ...envRead("messenger.conversations.get", "/messenger/conversations/{conversation}", "Read original Messenger messages with saved human sender_display_name, contact form details, read receipts and attachments without marking the chat read."), params: environment.extend({ conversation: uuid }).strict(), query: z.object({ after: z.coerce.number().int().min(0).optional(), receipt_after: z.coerce.number().int().min(0).optional(), file_id: uuid.optional(), view: z.enum(["state"]).optional() }).strict() },
  envRead("pharmacy_calls.settings.read", "/pharmacy-calls/settings", "Read demo pharmacy-call voice, vocabulary and change history. Starts no call."),
  { ...write("pharmacy_calls.settings.update", `${environmentPath}/pharmacy-calls/settings`, "Save the demo pharmacy-call voice and vocabulary with the expected revision. Starts no call.", z.object({ revision: z.number().int().min(0), voice_id: z.string().max(40).nullable(), vocabulary: z.array(z.string().trim().min(1).max(60)).max(100) }).strict()), params: environment, ownership: "environment" },
];
