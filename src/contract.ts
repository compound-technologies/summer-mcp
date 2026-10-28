import { executionPolicySaveBody } from "./autonomy.ts";
import { guidanceScope, operatorGuidance } from "./schemas/workflows.ts";
import { CASE_TEACHING_OPERATIONS } from "./case-teaching-operations.ts";
import { GITHUB_OPERATIONS } from './github-operations.ts';
import { messengerIdentitySchema, messengerLogoSchema } from "./schemas/messenger-identity.ts";
// Summer developer contract: scopes, operations, ownership and error codes.
// The API router, MCP tools, OpenAPI document and CLI help are derived from
// this one catalog, so the three transports cannot drift apart silently.
// This is Summer's contract. It shares no authority with customer-system integrations.
import { z } from "zod";
import { messengerPresentationSchema } from "./schemas/messenger.ts";
import { capabilityDefinition, capabilityPath, capabilityResult } from "./schemas/capabilities.ts";
import { guideId, saveGuideInput, saveArticleInput, publishGuideInput, unpublishGuideInput, createAssetInput, editAssetInput, saveHostingInput, verifyHostingInput } from "./schemas/guides.ts";
import { INTERCOM_OPERATIONS } from "./intercom-operations.ts";
import { TEAMMATE_OPERATIONS } from "./teammate-operations.ts";
import { WORKSPACE_OPERATIONS, caseListQuery } from "./workspace-operations.ts";
import { SCHEDULED_JOB_OPERATIONS } from "./scheduled-job-operations.ts";

export const API_VERSION = "2026-10-20";
export const MCP_PROTOCOL_VERSIONS = ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"] as const;

export const SCOPES = {
  setup: {
    title: "Set up Summer",
    description: "Inspect and update capability readiness, configure integrations, install and enable Messenger in the selected environments, save selected credentials without reading them back, upload company knowledge and run supported checks.",
    admin: true,
  },
  "cases.read": {
    title: "Read cases",
    description: "Read company-owned cases, conversations, related records, attachments, runs, plans and receipts.",
    admin: false,
  },
  "investigations.request": {
    title: "Request investigations",
    description: "Ask Summer to investigate a case, revise a plan, stop an investigation or cancel a plan's text while it waits to send. Plans follow the company's review and auto-run rules.",
    admin: false,
  },
  "actions.prepare": {
    title: "Prepare actions for approval",
    description: "Prepare the exact work and review hash for approval in Summer or through an authorized delegated connection. Preparation never approves or executes anything.",
    admin: false,
  },
  "actions.approve": {
    title: "Approve authorized case actions",
    description: "Let your agent approve the exact prepared case work you authorize, including outgoing replies, under your current operator permissions. Records your identity, connection, authorization and plan hash. Does not grant identity attestations or clinical authority.",
    admin: true,
  },
  "workspace.write": {
    title: "Manage workspace work",
    description: "Save your inbox views, assign case work and record evidence-backed quality assessments. Shared views and scenario changes retain the company's existing administrator checks. Never grants roles or approves customer actions or privacy requests.",
    admin: false,
  },
  "credentials.replace": {
    title: "Replace live credentials",
    description: "Replace or remove a provider credential that is already saved and active.",
    admin: true,
  },
  "messaging.activate": {
    title: "Turn on production messaging",
    description: "Enable a production Messenger installation or automatic production assistant replies.",
    admin: true,
  },
  "guides.publish": {
    title: "Publish customer guides",
    description: "Publish or unpublish exact customer guide revisions and configure their public custom domain. Draft authoring and private uploads use setup.",
    admin: true,
  },
  "automation.manage": {
    title: "Manage automation",
    description: "Configure scheduled agent jobs, run them now, and create, rotate and disable company service accounts and signed webhooks.",
    admin: true,
  },
  // Service-account scopes. People reach events through setup.
  "events.read": { title: "Read events", description: "Read the company's configuration and activity events.", admin: false },
  "capabilities.read": { title: "Read capabilities", description: "Read company capabilities and setup status.", admin: false },
} as const;
export type Scope = keyof typeof SCOPES;
export const DELEGATED_SCOPES = ["setup", "cases.read", "investigations.request", "actions.prepare", "actions.approve", "workspace.write", "credentials.replace", "messaging.activate", "guides.publish", "automation.manage"] as const satisfies readonly Scope[];
export const DEFAULT_DELEGATED_SCOPES = DELEGATED_SCOPES;
export const SERVICE_SCOPES = ["events.read", "capabilities.read"] as const satisfies readonly Scope[];
export const ENVIRONMENTS = ["staging", "production"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

// Never part of any grant. Listed so clients and docs can say so precisely.
export const HUMAN_ONLY = [
  "Revealing a saved credential value",
  "Approving Summer platform access requests",
  "Ownership transfer and owner/admin role grants",
  "Raising model or assistant spending limits",
  "Identity-verification attestations and clinical directions",
] as const;

export const ERROR_CODES = {
  invalid_request: 400, invalid_token: 401, insufficient_scope: 403, approval_pending: 403, access_blocked: 403,
  company_not_granted: 403, environment_not_granted: 403, not_a_member: 403, admin_required: 403, human_required: 403,
  not_found: 404, method_not_allowed: 405, version_conflict: 409, idempotency_conflict: 422, idempotency_in_progress: 409,
  outcome_uncertain: 409, payload_too_large: 413, rate_limited: 429, unsupported: 422, unavailable: 503, developer_platform_disabled: 404,
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;
export class ApiError extends Error {
  code: ErrorCode; details?: Record<string, unknown>; retryable: boolean;
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>, retryable = false) { super(message); this.code = code; this.details = details; this.retryable = retryable; }
  get status() { return ERROR_CODES[this.code]; }
}

// Capability and setup states. "saved" is storage only; "verified" needs a
// supported live check bound to the current configuration revision.
export const STATES = ["saved", "verified", "pending", "unavailable", "enabled", "disabled", "not_configured", "failed", "unsupported"] as const;
export type State = (typeof STATES)[number];
export const UNAVAILABLE_REASONS = [
  "missing_scope", "admin_required", "approval_pending", "company_not_granted", "environment_not_granted",
  "environment_not_served", "operational_connection_pending", "case_data_not_admitted", "operations_source_external",
  "messenger_backend_unavailable", "credential_storage_unavailable", "unsupported", "human_required",
] as const;
export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number];

const uuid = z.string().uuid();
export const schemas = {
  uuid,
  company: uuid.describe("Summer company ID"),
  environment: z.enum(ENVIRONMENTS).describe("Environment that owns the resource"),
  credentialName: z.string().regex(/^[A-Z][A-Z0-9_]{0,127}$/).describe("Credential variable name, for example STRIPE_READ_KEY"),
  knowledgeId: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/).max(120).describe("Knowledge document ID"),
  version: z.number().int().min(0).describe("Current version you expect; 0 when the resource does not exist yet"),
  timezone: z.string().max(100),
  messengerSettings: z.object({
    enabled: z.boolean().describe("Live widget. The approved setup grant includes production installation and activation."),
    guests_enabled: z.boolean(),
    guest_attachments_enabled: z.boolean().optional(),
    guest_daily_conversation_limit: z.number().int().min(1).max(1000).optional(),
    guest_challenge_hourly: z.number().int().min(1).max(10000).optional(),
    display_name: z.string().trim().min(1).max(80).describe("Company name shown in the Messenger header"),
    logo_url: messengerLogoSchema.optional().describe("Public company logo shown in the header"),
    identity: messengerIdentitySchema.optional().describe("Agent name and AI disclosure. Defaults to named support with a neutral first name and last initial."),
    allowed_origins: z.array(z.string().max(256)).min(1).max(20).describe("Exact website origins, https (http://localhost allowed in staging)"),
    privacy_url: z.string().max(512),
    fallback_url: z.string().max(512),
    office_hours: z.string().max(200),
    presentation: messengerPresentationSchema.optional().describe("Company chat colors, welcome and chat copy, home/chat links and contact form labels. Consent text supports multiple [label](https://example.com/policy) links; other copy is plain text. Links use HTTPS. Scoped to this installation."),
    routing: z.object({
      clinician_url: z.string().max(512).optional(), sign_in_url: z.string().max(512).optional(), catalog_url: z.string().max(512).optional(),
      offer_url: z.string().max(512).optional(), offer_label: z.string().max(80).optional(), destination_origins: z.array(z.string().max(256)).max(10).optional(),
    }).strict().optional(),
  }).strict(),
  assistantSettings: z.object({
    enabled: z.boolean().describe("Automatic replies. The approved setup grant includes production activation within the current spending limit."),
    instructions: z.string().trim().min(1).max(50000),
    lead_capture_enabled: z.boolean().optional().describe("Offer an optional consent-based contact form in chat."),
    escalation_enabled: z.boolean().optional().describe("Allow investigation handoffs. Set false for a product and sales chat."),
    budget_cents: z.number().int().min(1).max(10000).describe("Cannot exceed the current limit through the API"),
    daily_budget_cents: z.number().int().min(100).max(1000000).optional().describe("Daily spending limit. Delegated clients may keep or reduce the saved limit."),
    max_concurrent_chats: z.number().int().min(1).max(200).optional(),
  }).strict(),
  voiceSettings: z.object({
    enabled: z.boolean().describe("Show the voice button in chat for the chosen audience."),
    audience: z.enum(["accounts", "signed_in", "everyone"]).describe("accounts: only allowed_subjects; signed_in: any verified account; everyone: visitors too."),
    allowed_subjects: z.array(z.string().trim().min(1).max(200)).max(50).describe("Verified account subjects your site sends at sign-in. Used when audience is accounts."),
    provider: z.enum(["openai", "openai_live", "elevenlabs"]).optional().describe("Voice service. openai_live (OpenAI GPT-Live) is the default: it listens while it speaks and hands questions to Summer. openai is OpenAI Realtime. Omit to keep the saved choice."),
    voice_id: z.string().regex(/^[A-Za-z0-9]{8,40}$/).describe("ElevenLabs voice: one of the voices listed by messenger.voice.read."),
    openai_voice: z.enum(["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"]).optional().describe("OpenAI voice for openai and openai_live: one of the openai_voices listed by messenger.voice.read. Omit to keep the saved choice."),
    instructions: z.string().max(20000).describe("Optional company instructions added to the standard voice instructions."),
    vocabulary: z.array(z.string().trim().min(1).max(60)).max(100).describe("Words speech recognition should expect, such as product names."),
  }).strict(),
};

export type Ownership = "user" | "company" | "environment";
export type Effect = "read" | "write" | "secret_write" | "request";
export type McpExposure = "full" | "handoff" | "none";
export type Operation = {
  destructive?: boolean;
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  scope: Scope | null;
  ownership: Ownership;
  effect: Effect;
  summary: string;
  params?: z.ZodObject<z.ZodRawShape>;
  query?: z.ZodObject<z.ZodRawShape>;
  body?: z.ZodType;
  mcp: McpExposure;
  release: "A" | "B" | "C" | "D";
  // When set, an alternate scope also admits the operation (for example a
  // service account reading events instead of a person with setup).
  alsoScope?: Scope;
  /** Raw file bytes use the same authorization/executor, never MCP arguments. */
  bodyKind?: "binary";
};

const companyEnv = z.object({ company: schemas.company, environment: schemas.environment }).strict();
const companyOnly = z.object({ company: schemas.company }).strict();
const page = z.object({ cursor: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(200).optional() }).strict();
const credentialBody = z.discriminatedUnion("source", [
  z.object({ source: z.literal("value"), value: z.string().min(1).max(16384), expected_version: schemas.version }).strict(),
  z.object({ source: z.literal("doppler"), secret_name: schemas.credentialName, expected_version: schemas.version }).strict(),
]);
const caseParams = companyEnv.extend({ case: uuid }).strict();
const instant = z.string().datetime({ offset: true }).describe("ISO 8601 time with an offset, for example 2026-10-01T00:00:00Z");
const yesNo = z.union([z.boolean(), z.enum(["true", "false"])]);
const caseSearchQuery = z.object({
  q: z.string().trim().min(2).max(200).optional().describe("Customer name, email, phone, support code, order or tracking number, Stripe, MDI, Beluga or GEN ID, or care session ID. With messages=true, also words in customer and team messages."),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Exact date of birth, YYYY-MM-DD. With q, keeps only customers that match both."),
  messages: yesNo.optional().describe("Also search message text for q. Needs q."),
  status: z.enum(["open", "resolved", "all"]).optional().describe("Default all"),
  created_after: instant.optional(), created_before: instant.optional(),
  activity_after: instant.optional().describe("Cases updated at or after this time"), activity_before: instant.optional().describe("Cases updated before this time"),
  include_test: yesNo.optional().describe("Include staff and test accounts"),
  limit: z.coerce.number().int().min(1).max(100).optional().describe("Default 25"),
}).strict();
const plansQuery = z.object({
  show: z.enum(["executed", "all"]).optional().describe("executed (default): plans whose approved work was sent to run; all: every published plan"),
  approver: z.enum(["any", "person", "agent", "auto_run"]).optional().describe("agent: approved through a person's delegated API, CLI or MCP connection. auto_run: approved by a channel's auto-run setting"),
  call: z.enum(["any", "would_run", "would_not_run", "no_call"]).optional().describe("The agent's own call on running the plan without approval, judged against the company's autonomy rubric"),
  cursor: z.string().regex(/^[1-9]\d{0,5}$/).optional(),
}).strict();
const runsQuery = z.object({
  status: z.enum(["all", "approval", "active", "queued", "review", "completed", "stopped", "waiting"]).optional().describe("approval: plans waiting for human approval; review: runs that need a person to check them"),
  kind: z.enum(["all", "investigation", "execution"]).optional(),
  executed: yesNo.optional().describe("Only approved executions, with their effects"),
  sort: z.enum(["results", "created", "started", "approved"]).optional(),
  created_after: instant.optional(), created_before: instant.optional(),
  cursor: z.string().regex(/^[1-9]\d{0,5}$/).optional(),
}).strict();

export const OPERATIONS: Operation[] = [
  ...GITHUB_OPERATIONS,
  ...WORKSPACE_OPERATIONS,
  ...SCHEDULED_JOB_OPERATIONS,
  ...CASE_TEACHING_OPERATIONS,
  ...INTERCOM_OPERATIONS,
  ...TEAMMATE_OPERATIONS,
  // Account: any connection, including a person whose access is pending.
  { id: "client.status", method: "GET", path: "/client-status", scope: null, ownership: "user", effect: "read", mcp: "full", release: "A",
    summary: "Check live Summer MCP/API versions, old client warnings and the seven-day discovery refresh interval. Optional cached client versions and the last successful check timestamp distinguish known and unknown status.",
    query: z.object({ cli_version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(), mcp_version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(), last_checked_at: instant.optional() }).strict() },
  { id: "account.me", method: "GET", path: "/me", scope: null, ownership: "user", effect: "read", mcp: "full", release: "A",
    summary: "Show the signed-in person, Summer access status, profile photo path and this connection's grant." },
  { id: "account.photo.upload", method: "PUT", path: "/me/photo", scope: null, ownership: "user", effect: "write", mcp: "none", release: "A", bodyKind: "binary",
    body: z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), byte_length: z.number().int().min(1).max(2097152) }).strict(),
    summary: "Upload your own profile photo (PNG, JPEG or WebP, at most 2 MB) as application/octet-stream. Customers see it beside Messenger replies you send. Use the local CLI or the API; never pass image bytes through MCP." },
  { id: "account.photo.remove", destructive: true, method: "DELETE", path: "/me/photo", scope: null, ownership: "user", effect: "write", mcp: "full", release: "A",
    summary: "Remove your own profile photo. Replies you send afterward show your initials; earlier replies keep the photo they were sent with." },
  { id: "account.companies.list", method: "GET", path: "/companies", scope: null, ownership: "user", effect: "read", mcp: "full", release: "A",
    summary: "List companies the person can access and whether this connection includes each one." },
  { id: "account.access_request.read", method: "GET", path: "/access-request", scope: null, ownership: "user", effect: "read", mcp: "full", release: "A",
    summary: "Read the person's Summer access request. Approval is a separate Summer team decision." },
  { id: "account.access_request.submit", method: "POST", path: "/access-request", scope: null, ownership: "user", effect: "request", mcp: "full", release: "A",
    summary: "Submit or update a Summer access request. This cannot approve access.",
    body: z.object({ company_name: z.string().trim().min(1).max(120), note: z.string().trim().max(2000) }).strict() },
  { id: "account.invitation.accept", method: "POST", path: "/invitations/accept", scope: null, ownership: "user", effect: "write", mcp: "none", release: "A",
    summary: "Accept a company invitation sent to this person. Authorize again to add the company to a connection.",
    body: z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict() },
  { id: "account.connections.list", method: "GET", path: "/connections", scope: null, ownership: "user", effect: "read", mcp: "full", release: "A",
    summary: "List this person's agent connections, grants, last use and expiry." },
  { id: "account.connections.revoke", method: "POST", path: "/connections/{connection}/revoke", scope: null, ownership: "user", effect: "write", mcp: "full", release: "A",
    summary: "Revoke one of this person's agent connections immediately.", params: z.object({ connection: uuid }).strict(),
    body: z.object({ reason: z.string().trim().max(200).optional() }).strict() },

  // Release A: setup.
  { id: "guides.get", method: "GET", path: "/companies/{company}/guides", scope: "setup", alsoScope: "guides.publish", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read the company's editable guidebook, draft articles, assets and publication state. Customer guides share the existing company knowledge source.", params: companyOnly },
  { id: "guides.save", method: "PUT", path: "/companies/{company}/guides", scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Create or edit guidebook details at the expected version. Saves a private draft; does not publish.", params: companyOnly, body: saveGuideInput },
  { id: "guides.articles.get", method: "GET", path: "/companies/{company}/guides/articles/{article}", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read an editable guide article and its current knowledge revision.", params: companyOnly.extend({ article: guideId }).strict() },
  { id: "guides.articles.save", method: "PUT", path: "/companies/{company}/guides/articles/{article}", scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Create or edit a Markdown customer article with source references and managed asset IDs. Saves a draft in the shared knowledge library; later edits do not change a published release.", params: companyOnly.extend({ article: guideId }).strict(), body: saveArticleInput },
  { id: "guides.preview", method: "GET", path: "/companies/{company}/guides/preview", scope: "setup", alsoScope: "guides.publish", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read the exact current draft, article revisions and authenticated preview URL before publishing. No public access token is issued.", params: companyOnly },
  { id: "guides.authoring", method: "GET", path: "/companies/{company}/guides/authoring", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read the company's reviewed guide-authoring brief, draft article references and publication state. This read starts no model run and changes no customer data.", params: companyOnly },
  { id: "guides.publish", method: "POST", path: "/companies/{company}/guides/publish", scope: "guides.publish", ownership: "company", effect: "request", mcp: "full", release: "A",
    summary: "Publish a complete release of the company's customer help center. The release replaces every published article: list each article that should stay public (guides.preview publication.articles) and name any published article you mean to remove in unpublish. Requires explicit publication authority; does not approve customer business actions.", params: companyOnly, body: publishGuideInput },
  { id: "guides.unpublish", method: "POST", path: "/companies/{company}/guides/unpublish", scope: "guides.publish", ownership: "company", effect: "request", mcp: "full", release: "A",
    summary: "Remove the company's guide and release media from Summer's public serving path at the expected version. Downloaded copies cannot be recalled.", params: companyOnly, body: unpublishGuideInput },
  { id: "guides.history", method: "GET", path: "/companies/{company}/guides/history", scope: "setup", alsoScope: "guides.publish", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read the company's guide edits, upload and publication history.", params: companyOnly },
  { id: "guides.hosting.get", method: "GET", path: "/companies/{company}/guides/hosting", scope: "setup", alsoScope: "guides.publish", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read the optional custom guide domain, DNS instructions and verified HTTPS status. Summer-hosted guide URLs need no customer DNS setup.", params: companyOnly },
  { id: "guides.hosting.save", method: "PUT", path: "/companies/{company}/guides/hosting", scope: "guides.publish", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Save or remove a custom guide hostname at the expected version. Saving a name does not verify ownership or provision HTTPS.", params: companyOnly, body: saveHostingInput },
  { id: "guides.hosting.verify", method: "POST", path: "/companies/{company}/guides/hosting/verify", scope: "guides.publish", ownership: "company", effect: "request", mcp: "full", release: "A",
    summary: "Check the saved domain's DNS ownership, attach it through Summer's hosting connection and verify HTTPS. Returns pending until each check succeeds.", params: companyOnly, body: verifyHostingInput },
  { id: "assets.list", method: "GET", path: "/companies/{company}/guide-assets", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "List the company's private guide media, metadata and upload status. Uploading does not make a file public.", params: companyOnly },
  { id: "assets.get", method: "GET", path: "/companies/{company}/guide-assets/{asset}", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read one guide asset, checksum and resumable chunk receipts. No secret upload capability is returned.", params: companyOnly.extend({ asset: uuid }).strict() },
  { id: "assets.uploads.create", method: "POST", path: "/companies/{company}/guide-assets", scope: "setup", ownership: "company", effect: "request", mcp: "full", release: "A",
    summary: "Start or recover a private resumable Markdown, image, video, PDF or caption upload from metadata. File bytes are transferred separately; this hosted endpoint has no local filesystem access.", params: companyOnly, body: createAssetInput },
  { id: "assets.uploads.write", method: "PUT", path: "/companies/{company}/guide-assets/{asset}/chunks/{index}", scope: "setup", ownership: "company", effect: "write", mcp: "none", release: "A", bodyKind: "binary",
    summary: "Transfer one immutable file chunk of at most 2 MiB as application/octet-stream with the local CLI's Summer token. Never pass binary or base64 file bodies through MCP.",
    params: companyOnly.extend({ asset: uuid, index: z.coerce.number().int().min(0).max(127).transform(String) }).strict(),
    body: z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), byte_length: z.number().int().min(1).max(2097152) }).strict() },
  { id: "assets.uploads.complete", method: "POST", path: "/companies/{company}/guide-assets/{asset}/complete", scope: "setup", ownership: "company", effect: "request", mcp: "full", release: "A",
    summary: "Verify the original size, content signature and SHA-256 against saved private bytes, then mark a guide upload ready. A ready file remains private until published in a guide.", params: companyOnly.extend({ asset: uuid }).strict(), body: z.object({}).strict() },
  { id: "assets.edit", method: "PATCH", path: "/companies/{company}/guide-assets/{asset}", scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Edit guide media captions, alt text, provenance, transcript or poster at the expected version, or retire unused media. Published releases keep their pinned metadata.", params: companyOnly.extend({ asset: uuid }).strict(), body: editAssetInput },
  { id: "company.capabilities", method: "GET", path: "/companies/{company}/environments/{environment}/capabilities", scope: "setup", alsoScope: "capabilities.read", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "What this connection can do here, with a reason for everything unavailable.", params: companyEnv },
  { id: "company.setup_status", method: "GET", path: "/companies/{company}/environments/{environment}/setup", scope: "setup", alsoScope: "capabilities.read", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Saved, verified, pending, unavailable and enabled state for each setup item.", params: companyEnv },
  { id: "capability_checks.list", method: "GET", path: "/companies/{company}/environments/{environment}/capability-checks", scope: "capabilities.read", alsoScope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Read the same operational capability checklist, results, discovery paths and review history shown in Summer. Every usable API, browser or knowledge path can count.", params: companyEnv },
  { id: "capability_checks.get", method: "GET", path: "/companies/{company}/environments/{environment}/capability-checks/{capability}", scope: "capabilities.read", alsoScope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Read one capability, its concrete test, evidence and latest 20 review records.", params: companyEnv.extend({ capability: capabilityDefinition.shape.id }).strict() },
  { id: "capability_checks.save", method: "PUT", path: "/companies/{company}/environments/{environment}/capability-checks/{capability}", scope: "setup", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Edit a capability expectation or add a business-specific custom_ capability with a reason. Resets its result and retains history. Does not create a provider tool or grant execution access.", params: companyEnv.extend({ capability: capabilityDefinition.shape.id }).strict(),
    body: z.object({ expected_version: schemas.version, definition: capabilityDefinition, notes: z.string().trim().min(1).max(2000) }).strict() },
  { id: "capability_checks.report", method: "POST", path: "/companies/{company}/environments/{environment}/capability-checks/{capability}/reports", scope: "setup", ownership: "environment", effect: "request", mcp: "full", release: "A",
    summary: "Record the setup agent's capability assessment with original evidence and the path Summer can discover and use. A pass needs evidence and a discovery path. Reports are labeled as agent-reported, never human approval or independently verified execution.", params: companyEnv.extend({ capability: capabilityDefinition.shape.id }).strict(),
    body: z.object({ expected_version: schemas.version, state: capabilityResult, notes: z.string().trim().min(1).max(2000), evidence: z.string().trim().max(2000), fulfillment: capabilityPath.optional() }).strict() },
  { id: "capability_checks.test", method: "POST", path: "/companies/{company}/environments/{environment}/capability-checks/{capability}/tests", scope: "setup", ownership: "environment", effect: "request", mcp: "full", release: "A",
    summary: "Request a read-only Summer capability test on an authorized sample case. Also needs investigations.request and current runtime access. Does not approve or execute customer changes.", params: companyEnv.extend({ capability: capabilityDefinition.shape.id }).strict(),
    body: z.object({ expected_version: schemas.version, case_id: uuid }).strict() },
  { id: "company.settings.read", method: "GET", path: "/companies/{company}/settings", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read company-wide settings, including the email subject customers see on new support emails. Changes affect every environment.", params: companyOnly },
  { id: "company.settings.update", method: "PATCH", path: "/companies/{company}/settings", scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Update company-wide settings with the expected version. Affects every environment.", params: companyOnly,
    body: z.object({ name: z.string().trim().min(1).max(120), timezone: schemas.timezone, workflow: z.enum(["support", "order_status", "billing", "custom"]), note: z.string().trim().max(1000),
      email_subject: z.string().trim().max(150).regex(/^[^\r\n\t]*$/, "Use one line.").optional().describe("Subject customers see on a new support email, such as \"Your Example Co support request\". Replies to a customer's email keep their subject. Leave out to keep the saved subject; an empty string clears it."),
      expected_version: schemas.version }).strict() },
  { id: "integrations.list", method: "GET", path: "/companies/{company}/environments/{environment}/integrations", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "List provider integrations, their categories, required fields, alternative credential sets and saved metadata. Filter by search, category or connection. Connected means all required credentials and one complete alternative set are available, not a live provider check. read_only integrations are read with the company's own key and never written through. Never returns values.", params: companyEnv,
    query: z.object({ search: z.string().trim().max(200).optional(), category: z.enum(["clinical", "messaging", "helpdesk", "orders", "shipping", "billing", "marketing", "data", "custom"]).optional(), connection: z.enum(["connected", "not_connected"]).optional() }).strict() },
  { id: "integrations.save", method: "PUT", path: "/companies/{company}/environments/{environment}/integrations/{integration}", scope: "setup", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Save a custom integration's description, setup instructions and credential field names. This saves metadata only, without credential values or a live connection check.", params: companyEnv.extend({ integration: z.string().regex(/^custom-[a-z0-9-]{1,64}$/) }).strict(),
    body: z.object({ expected_version: schemas.version, name: z.string().trim().min(1).max(100), description:z.string().trim().max(500).default(''),instructions:z.string().trim().max(4000).default(''),fields: z.array(z.object({ name: schemas.credentialName, label: z.string().trim().min(1).max(100), required: z.boolean() }).strict()).min(1).max(128) }).strict() },
  { id: "integrations.setup_prompt", method: "POST", path: "/companies/{company}/environments/{environment}/integrations/setup-prompt", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Prepare an integration-specific MCP setup prompt and Codex or Claude Code app links. Includes the selected company, environment and setup brief, never credential values. Does not launch an app or change configuration.", params: companyEnv,
    body:z.object({name:z.string().trim().min(1).max(100),description:z.string().trim().max(500).default(''),instructions:z.string().trim().max(4000).default(''),id:z.string().regex(/^custom-[a-z0-9-]{1,64}$/).optional(),fields:z.array(z.object({name:schemas.credentialName,label:z.string().trim().min(1).max(100),required:z.boolean()}).strict()).max(128).default([])}).strict() },
  { id: "credentials.list", method: "GET", path: "/companies/{company}/environments/{environment}/credentials", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "List saved credential names, sources and versions. Never returns values.", params: companyEnv },
  { id: "credentials.set", method: "PUT", path: "/companies/{company}/environments/{environment}/credentials/{name}", scope: "setup", ownership: "environment", effect: "secret_write", mcp: "handoff", release: "A",
    summary: "Save one selected credential value or Doppler reference. Replacing an active credential needs credentials.replace. Returns metadata only.",
    params: companyEnv.extend({ name: schemas.credentialName }).strict(), body: credentialBody },
  { id: "credentials.remove", method: "DELETE", path: "/companies/{company}/environments/{environment}/credentials/{name}", scope: "credentials.replace", ownership: "environment", effect: "write", mcp: "none", release: "A",
    summary: "Remove an active credential with the expected version.", params: companyEnv.extend({ name: schemas.credentialName }).strict(),
    query: z.object({ expected_version: z.coerce.number().int().min(1) }).strict() },
  { id: "knowledge.list", method: "GET", path: "/companies/{company}/knowledge", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "List current company knowledge documents. Knowledge is company-wide, not per environment. Pass tag to list documents with that tag, such as an integration name (slack, beluga, mdi), which is how Summer shows knowledge related to an integration.", params: companyOnly,
    query: z.object({ query: z.string().max(200).optional(), tag: z.string().regex(/^[a-z0-9-]{1,60}$/).optional(), offset: z.coerce.number().int().min(0).max(100000).optional() }).strict() },
  { id: "knowledge.create", method: "POST", path: "/companies/{company}/knowledge", scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Upload a new company knowledge document with original revision history. The shared library is used by all roles and environments. Existing document IDs are refused. API reference: https://api.gosummer.ai/v1/openapi.json", params: companyOnly,
    body: z.object({ id: schemas.knowledgeId, path: z.string().regex(/^company\/[a-z0-9][a-z0-9._/-]*\.md$/).max(240), content: z.string().trim().min(1).max(1_000_000), tags: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(20).default([]), reason: z.string().trim().min(1).max(2000) }).strict() },
  { id: "knowledge.changes", method: "GET", path: "/companies/{company}/knowledge/changes", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read company knowledge changes from people, delegated API/MCP connections and Summer agent plans, with before/after revisions, GPT change summaries, summary processing state and original provenance. Set actor=summer for Summer plans and Teach Summer edits.",
    params: companyOnly, query: z.object({offset:z.coerce.number().int().min(0).max(100000).optional(),actor:z.enum(["all","summer"]).optional()}).strict() },
  { id: "knowledge.get", method: "GET", path: "/companies/{company}/knowledge/{document}", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read one company knowledge document and its current revision.", params: companyOnly.extend({ document: schemas.knowledgeId }).strict() },
  { id: "knowledge.history", method: "GET", path: "/companies/{company}/knowledge/{document}/history", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read the edit history of a company knowledge document with GPT change summaries and processing state. Set actor=summer for Summer plans and Teach Summer edits.", params: companyOnly.extend({ document: schemas.knowledgeId }).strict(),
    query: z.object({ offset: z.coerce.number().int().min(0).max(100000).optional(), actor: z.enum(["all", "summer"]).optional() }).strict() },
  { id: "knowledge.edit", method: "PUT", path: "/companies/{company}/knowledge/{document}", scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Edit an existing company knowledge document with the expected revision and a reason. Affects every environment and later runs.",
    params: companyOnly.extend({ document: schemas.knowledgeId }).strict(),
    body: z.object({ revision: z.number().int().positive(), content: z.string().trim().min(1).max(1_000_000), status: z.enum(["active", "retired"]), reason: z.string().trim().min(1).max(2000) }).strict() },
  { id: "messenger.installations.list", method: "GET", path: "/companies/{company}/environments/{environment}/messenger/installations", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "List Messenger installations in this environment. Signing keys are never returned.", params: companyEnv },
  { id: "messenger.installations.create", destructive: false, method: "POST", path: "/companies/{company}/environments/{environment}/messenger/installations", scope: "setup", ownership: "environment", effect: "secret_write", mcp: "handoff", release: "A",
    summary: "Create an installation with a client-chosen ID. The one-time signing key goes to the trusted local helper, never to model-visible output.",
    params: companyEnv, body: z.object({ id: uuid.describe("New installation ID chosen by the client, so a retry cannot create a duplicate"), settings: schemas.messengerSettings }).strict() },
  { id: "messenger.installations.update", destructive: false, method: "PATCH", path: "/companies/{company}/environments/{environment}/messenger/installations/{installation}", scope: "setup", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Update installation settings with the expected version. Keeps the signing key.",
    params: companyEnv.extend({ installation: uuid }).strict(), body: z.object({ expected_version: z.number().int().min(1), settings: schemas.messengerSettings }).strict() },
  { id: "messenger.installations.rotate_key", method: "POST", path: "/companies/{company}/environments/{environment}/messenger/installations/{installation}/rotate-key", scope: "setup", ownership: "environment", effect: "secret_write", mcp: "handoff", release: "A",
    summary: "Issue a new signing key. Existing signed sessions end. The key goes to the trusted local helper only.",
    params: companyEnv.extend({ installation: uuid }).strict(), body: z.object({ expected_version: z.number().int().min(1) }).strict() },
  { id: "messenger.assistant.read", method: "GET", path: "/companies/{company}/environments/{environment}/messenger/assistant", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Read assistant settings per installation and whether the managed runtime is enabled.", params: companyEnv },
  { id: "messenger.leads.list", method: "GET", path: "/companies/{company}/environments/{environment}/messenger/leads", scope: "cases.read", ownership: "environment", effect: "read", mcp: "full", release: "B",
    summary: "Read consented website leads for this company and environment. Includes volunteered contact details and original submission references.", params: companyEnv, query: z.object({ before: z.string().max(120).optional() }).strict() },
  { id: "messenger.leads.handoff", method: "POST", path: "/companies/{company}/environments/{environment}/messenger/leads/handoff", scope: "cases.read", ownership: "environment", effect: "read", mcp: "none", release: "B",
    summary: "Exchange a short-lived booking handoff code on your server. Returns only this company's submitted contact details. Never use it as account identity.", params: companyEnv, body: z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict() },
  { id: "messenger.assistant.update", destructive: false, method: "PUT", path: "/companies/{company}/environments/{environment}/messenger/installations/{installation}/assistant", scope: "setup", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Update assistant instructions and escalation permission with the expected revision. Company facts live in shared knowledge. Cannot raise the spending limit.",
    params: companyEnv.extend({ installation: uuid }).strict(), body: z.object({ revision: z.number().int().positive(), settings: schemas.assistantSettings }).strict() },
  { id: "messenger.voice.read", method: "GET", path: "/companies/{company}/environments/{environment}/messenger/voice", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Read voice chat settings per installation, the voice services and their voices, published help article count and the voice assistant's update status.", params: companyEnv },
  { id: "messenger.voice.update", destructive: false, method: "PUT", path: "/companies/{company}/environments/{environment}/messenger/installations/{installation}/voice", scope: "setup", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Update voice chat settings with the expected revision. Summer updates the voice assistant from these settings and the company's published help articles.",
    params: companyEnv.extend({ installation: uuid }).strict(), body: z.object({ revision: z.number().int().min(0), settings: schemas.voiceSettings }).strict() },
  { id: "messenger.email.read", method: "GET", path: "/companies/{company}/environments/{environment}/messenger/email", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Read support email addresses: the private forwarding address, the one DNS record to add, whether mail has arrived, sending status, Gmail forwarding codes and emails that need a look.", params: companyEnv },
  { id: "messenger.email.create", destructive: false, method: "POST", path: "/companies/{company}/environments/{environment}/messenger/email", scope: "setup", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Add a support email address. Summer creates its private forwarding address and signing key and returns the DNS record to add. The address starts off; nothing is sent.",
    params: companyEnv, body: z.object({
      support_address: z.string().email().max(254).describe("The address customers already write to, such as support@example.com."),
      display_name: z.string().trim().min(1).max(80).describe("Sender name customers see on replies."),
      installation_id: uuid.optional().describe("Messenger installation whose inbox the emails join. Defaults to the first installation."),
    }).strict() },
  { id: "messenger.email.update", destructive: false, method: "PUT", path: "/companies/{company}/environments/{environment}/messenger/email/{channel}", scope: "setup", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Change the sender name or turn a support email address on or off, with the expected version. Turning on needs one received email. Turning off keeps every email but stops new conversations and replies.",
    params: companyEnv.extend({ channel: uuid }).strict(), body: z.object({ version: z.number().int().positive(), display_name: z.string().trim().min(1).max(80).optional(), enabled: z.boolean().optional() }).strict() },
  { id: "messenger.email.check", method: "POST", path: "/companies/{company}/environments/{environment}/messenger/email/{channel}/check", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Check forwarding, the DNS record and sending status for one support email address now. Records the latest sending status; sends nothing.",
    params: companyEnv.extend({ channel: uuid }).strict() },
  { id: "messenger.autonomy.read", method: "GET", path: "/companies/{company}/environments/{environment}/messenger/autonomy", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Read the company execution policy and its publishing history, plus autonomy for website chat, texting and email: whether the assistant gives fast replies and how sure it must be to answer alone, and the auto-run plan settings, including who turned auto-run on and website chat installation readiness (chat_assistant).", params: companyEnv },
  { id: "messenger.autonomy.update", destructive: false, method: "PUT", path: "/companies/{company}/environments/{environment}/messenger/autonomy/{channel}", scope: "setup", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Change one channel's autonomy with the expected version. With fast reply on, the assistant handles that channel's messages and starts a plan only when it escalates. A lower threshold gives it more autonomy.",
    params: companyEnv.extend({ channel: z.enum(["chat", "sms", "email"]) }).strict(), body: z.object({ version: z.number().int().min(0),
      fast_reply_enabled: z.boolean().optional().describe("The assistant answers this channel's messages."),
      fast_reply_threshold: z.number().int().min(0).max(100).optional().describe("How sure the assistant must be to answer alone, 0 to 100. Lower means more autonomy. Default 50."),
      auto_run_enabled: z.boolean().optional().describe("Run this channel's plans without waiting for a person when the agent says it would run the plan, all five self-review checks pass and it is at least auto_run_threshold sure. Plans with A/B/C options, money, identity or clinical work always wait for a person. The admin who turns it on is the recorded approver. Default off."),
      auto_run_threshold: z.number().int().min(0).max(100).optional().describe("How sure the agent must be before a plan runs alone, 0 to 100. Lower means more autonomy. Default 95. Auto-run stays off until enabled."),
    }).strict() },
  { id: "autonomy.policy.preview", method: "POST", path: "/companies/{company}/environments/{environment}/autonomy/policy/preview", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Preview the complete replacement execution policy. Conversation reply grants remain separate; explicit communication review exceptions apply to replies too. Returns an exact preview hash; changes nothing.", params: companyEnv, body: executionPolicySaveBody },
  { id: "autonomy.policy.update", destructive: false, method: "PUT", path: "/companies/{company}/environments/{environment}/autonomy/policy", scope: "setup", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Publish the complete previewed company execution policy under the authenticated administrator's authority. Requires a person's delegated messaging.activate grant, expected version and preview_hash. Replaces legacy inbound-channel plan permission. Does not run old held plans.", params: companyEnv, body: executionPolicySaveBody.extend({ preview_hash: z.string().regex(/^[a-f0-9]{32}$/) }).strict() },
  { id: "autonomy.plans.preview", method: "POST", path: "/companies/{company}/environments/{environment}/autonomy/plans/preview", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Count latest pending plans per open ticket across the connected operations company, including partner/system/operator origins. Other tenants cover only their Messenger tickets. Returns aggregate scores, holds, coverage and an exact refresh preview; starts nothing. auto_run:true previews only plans that could run on their own under current auto-run settings.", params: companyEnv, body: z.object({ missing_only: z.boolean().default(true), auto_run: z.boolean().default(false) }).strict() },
  { id: "autonomy.plans.refresh", destructive: true, method: "POST", path: "/companies/{company}/environments/{environment}/autonomy/plans/refresh", scope: "investigations.request", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Queue fresh research for the exact pending-plan preview, up to 100 tickets. Each fresh plan follows the ordinary auto-run eligibility rule. auto_run:true (matching the preview) picks only plans that could run on their own. Never replays old effects. Requires a new preview if work changed; successful repeats return the original receipt.", params: companyEnv, body: z.object({ missing_only: z.boolean().default(true), auto_run: z.boolean().default(false), preview_hash: z.string().regex(/^[a-f0-9]{32}$/) }).strict() },
  { id: "messenger.autonomy.backfill.preview", method: "POST", path: "/companies/{company}/environments/{environment}/messenger/autonomy/backfill/preview", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Legacy channel policy only; unavailable after an explicit company-policy replacement. Preview existing Messenger work under saved autonomy settings: counts, a plan confidence histogram and a preview_hash. Returns no messages or customer records. Starts nothing. Up to 100 items per apply batch; totals cover all matching work.", params: companyEnv, body: z.object({}).strict() },
  { id: "messenger.autonomy.backfill.apply", destructive: true, method: "POST", path: "/companies/{company}/environments/{environment}/messenger/autonomy/backfill/apply", scope: "investigations.request", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Apply an exact backfill preview using saved settings. Queue unanswered conversations and fresh investigations of qualifying pending plans, up to 100 items. Enabled assistants may reply; new plans follow saved auto-run settings. Skips paused, active, failed or uncertain work. Does not replay old executions. Requires the exact preview_hash; changed settings or work require a new preview. Repeating a successful hash returns its saved receipt.", params: companyEnv, body: z.object({ preview_hash: z.string().regex(/^[a-f0-9]{32}$/) }).strict() },
  { id: "messenger.sms.read", method: "GET", path: "/companies/{company}/environments/{environment}/messenger/sms", scope: "setup", ownership: "environment", effect: "read", mcp: "full", release: "A",
    summary: "Read texting lines: each line's persona name, how it hands work to the team, reply hours and whether texts join conversations, plus recent send problems and the lines this deployment can text from. Whether the assistant replies is a channel autonomy setting.", params: companyEnv },
  { id: "messenger.sms.create", destructive: false, method: "POST", path: "/companies/{company}/environments/{environment}/messenger/sms", scope: "setup", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Add a texting line. Received texts on it can join Summer conversations. The line starts off; nothing is sent. Fast replies follow the texting channel's autonomy setting.",
    params: companyEnv, body: z.object({
      quo_phone_number_id: z.string().regex(/^PN[A-Za-z0-9]{1,60}$/).describe("The Quo line ID, from available_lines in messenger.sms.read."),
      persona_name: z.string().trim().min(1).max(80).describe("The name the assistant texts as, such as Alex."),
      persona_mode: z.enum(["human", "ai"]).optional().describe("human: a person on the team (default). ai: a visible AI assistant."),
      escalation_style: z.enum(["check_back", "manager"]).optional().describe("check_back (default): 'Let me check and get back to you.' manager: may say it is checking with a manager."),
      reply_start_hour: z.number().int().min(0).max(23).optional().describe("First hour the assistant may text, in the customer's local time. Default 8 (8am)."),
      reply_end_hour: z.number().int().min(1).max(24).optional().describe("Hour the assistant stops texting, in the customer's local time. Default 21 (9pm)."),
      installation_id: uuid.optional().describe("Messenger installation whose assistant instructions and knowledge the line uses. Defaults to the first installation."),
      ingest_phone_number_ids: z.array(z.string().regex(/^PN[A-Za-z0-9]{1,60}$/)).max(5).optional().describe("Other Quo lines, from available_lines, whose received texts join this line's conversations. Replies always go out from this line. Replaces the whole list; [] stops taking texts from other lines."),
    }).strict() },
  { id: "messenger.sms.update", destructive: false, method: "PUT", path: "/companies/{company}/environments/{environment}/messenger/sms/{line}", scope: "setup", ownership: "environment", effect: "write", mcp: "full", release: "A",
    summary: "Change a texting line with the expected version: persona name, handoff wording, reply hours, other Quo lines it takes texts in from and whether texts join conversations. Turn fast replies on or off in messenger.autonomy.update.",
    params: companyEnv.extend({ line: uuid }).strict(), body: z.object({ version: z.number().int().positive(),
      persona_name: z.string().trim().min(1).max(80).optional(), persona_mode: z.enum(["human", "ai"]).optional(), escalation_style: z.enum(["check_back", "manager"]).optional(),
      reply_start_hour: z.number().int().min(0).max(23).optional(), reply_end_hour: z.number().int().min(1).max(24).optional(),
      enabled: z.boolean().optional().describe("Received texts join Summer conversations."),
      ingest_phone_number_ids: z.array(z.string().regex(/^PN[A-Za-z0-9]{1,60}$/)).max(5).optional().describe("Other Quo lines, from available_lines, whose received texts join this line's conversations. Replies always go out from this line. Replaces the whole list; [] stops taking texts from other lines."),
    }).strict() },
  { id: "slack.identity.read", method: "GET", path: "/companies/{company}/slack/identity", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read the support name and avatar shown on Summer's approved Slack replies, whether the Slack install allows them, and the change history.", params: companyOnly },
  { id: "slack.identity.update", destructive: false, method: "PUT", path: "/companies/{company}/slack/identity", scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Set the support name and avatar on Summer's approved Slack replies, with the expected revision and a reason. Null values use the plain Summer Ellis identity. Sends no message.",
    params: companyOnly, body: z.object({
      revision: z.number().int().min(0).describe("Current revision from slack.identity.read; 0 before the first save."),
      display_name: z.string().trim().min(1).max(80).nullable().describe("Support name shown on replies, such as the company's support team name. Slack still marks the post as an app."),
      avatar_url: z.string().max(500).regex(/^https:\/\/[^\s<>"]+$/).nullable().describe("Public https image link for the reply avatar."),
      reason: z.string().trim().min(1).max(1000),
    }).strict() },
  { id: "slack.channels.posting.update", destructive: false, method: "PUT", path: "/companies/{company}/slack/channels/{channel}/posting", scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Allow or stop approved agent replies in one vendor Slack channel, with the expected version from teammates.setup.status and a reason. Each reply still needs a person to approve its exact text. Sends no message.",
    params: companyOnly.extend({ channel: z.string().regex(/^[CG][A-Z0-9]+$/).describe("Slack channel ID from teammates.setup.status") }).strict(), body: z.object({
      allowed: z.boolean(),
      expected_version: z.number().int().min(0).describe("postingVersion from teammates.setup.status; 0 before the first change."),
      reason: z.string().trim().min(1).max(1000),
    }).strict() },
  { id: "slack.sender.update", destructive: false, method: "PUT", path: "/companies/{company}/slack/sender", scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Choose who posts approved vendor Slack replies: the Summer Ellis app, a Summer Teammate (AI employee) from its own Slack account, or the person who approves each reply, from their own connected Slack account. Uses the revision from slack.identity.read and a reason. Sends no message.",
    params: companyOnly, body: z.object({
      revision: z.number().int().min(0).describe("Current revision from slack.identity.read; 0 before the first save."),
      sender: z.enum(["summer_app", "teammate", "approver"]).optional().describe("Who posts. Leave out to choose from teammate_id alone. 'approver' posts as whoever approves each reply; that person needs their own Slack account connected (slack.account.read)."),
      teammate_id: uuid.nullable().describe("An active teammate from teammates.list when sender is 'teammate', otherwise null."),
      reason: z.string().trim().min(1).max(1000),
    }).strict() },
  { id: "slack.reader.read", method: "GET", path: "/companies/{company}/slack/reader", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read who Summer reads Slack as: the connection itself (the Summer app or the installer's personal read access), an AI employee, or an admin's own Slack account, whether that account is connected, the revision and the change history.", params: companyOnly },
  { id: "slack.reader.update", destructive: false, method: "PUT", path: "/companies/{company}/slack/reader", scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Choose who Summer reads Slack as, with the revision from slack.reader.read and a reason. 'me' uses the caller's own connected Slack account; nobody can choose another person's account. Summer reads only the selected channels that account can see. Sends no message.",
    params: companyOnly, body: z.object({
      revision: z.number().int().min(0).describe("Current revision from slack.reader.read; 0 before the first save."),
      reader: z.enum(["connection", "teammate", "me"]),
      teammate_id: uuid.nullable().optional().describe("An active teammate from teammates.list when reader is 'teammate'."),
      reason: z.string().trim().min(1).max(1000),
    }).strict() },
  { id: "slack.account.read", method: "GET", path: "/companies/{company}/slack/account", scope: "workspace.write", alsoScope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read whether the caller's own Slack account is connected to Summer in this company, and the settings link to connect it. Connecting uses Slack sign-in in a browser.", params: companyOnly },
  { id: "slack.account.disconnect", destructive: true, method: "POST", path: "/companies/{company}/slack/account/disconnect", scope: "workspace.write", alsoScope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Disconnect the caller's own Slack account from Summer in this company and delete its saved token. Replies set to post as the approver are then blocked for the caller, and Summer stops reading as the caller.", params: companyOnly },
  { id: "slack.member_link.read", method: "GET", path: "/companies/{company}/slack/member-link", scope: "workspace.write", alsoScope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "Read which Slack account Summer links to the caller in this company, how it was linked, the Slack people the caller can choose from, and whether Summer sends the caller Slack messages about assigned human tasks.", params: companyOnly },
  { id: "slack.member_link.update", destructive: false, method: "PUT", path: "/companies/{company}/slack/member-link", scope: "workspace.write", alsoScope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Choose the caller's own Slack account in this company, say they have none, or turn Slack messages about their human tasks on or off. Changes only the caller's settings.",
    params: companyOnly, body: z.object({
      slack_user_id: z.string().regex(/^[UW][A-Z0-9]{2,20}$/).nullable().optional().describe("A Slack person from slack.member_link.read options. Omit to keep the current account."),
      none: z.boolean().optional().describe("true: the caller does not use this Slack workspace."),
      notices: z.boolean().optional().describe("Slack messages about human tasks assigned to the caller. On by default."),
    }).strict().refine(body => body.slack_user_id !== undefined || body.none !== undefined || body.notices !== undefined, "Give slack_user_id, none or notices.") },
  { id: "slack.member_links.match", destructive: false, method: "POST", path: "/companies/{company}/slack/member-links/match", scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Admin: match every company member to their Slack account again, by email and name. Accounts people signed in with or chose stay as they are. Runs within a few minutes; sends no message.", params: companyOnly },
  { id: "slack.channels.list", method: "GET", path: "/companies/{company}/slack/channels", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "A",
    summary: "List the Slack channels the company selected for Summer, with read and post access and each channel's vendor and purpose. Agents see the vendor and purpose with every vendor Slack read.", params: companyOnly },
  { id: "slack.channels.describe", destructive: false, method: "PUT", path: "/companies/{company}/slack/channels/{channel}", scope: "setup", ownership: "company", effect: "write", mcp: "full", release: "A",
    summary: "Set which vendor a selected Slack channel is for and what it is used for, with a reason. Null clears a field. Changes guidance for agents and people; sends no message and changes no channel access.",
    params: companyOnly.extend({ channel: z.string().regex(/^[CG][A-Z0-9]+$/).describe("Slack channel ID from slack.channels.list") }).strict(), body: z.object({
      installation_id: uuid.describe("The Slack connection from slack.channels.list."),
      vendor: z.string().trim().min(1).max(60).nullable().describe("The vendor this channel is with, such as Beluga Health."),
      purpose: z.string().trim().min(1).max(400).regex(/^[^\u0000-\u001f]*$/).nullable().describe("What the channel is used for, in one or two plain sentences."),
      reason: z.string().trim().min(1).max(1000),
    }).strict() },
  { id: "company.team.read", method: "GET", path: "/companies/{company}/team", scope: "setup", ownership: "company", effect: "read", mcp: "full", release: "D",
    summary: "List company members and pending invitations. Role changes and invitations stay in Summer.", params: companyOnly },
  { id: "messenger.conversations.assistant", method: "POST", path: "/companies/{company}/environments/{environment}/messenger/conversations/{conversation}/assistant", scope: "setup", ownership: "environment", effect: "request", mcp: "full", release: "C",
    summary: "Pause the assistant in one conversation so a person can take over, or ask it to resume. Pausing stops automatic replies immediately.",
    params: companyEnv.extend({ conversation: uuid }).strict(), body: z.object({ paused: z.boolean() }).strict() },
  { id: "verification.run", method: "POST", path: "/companies/{company}/environments/{environment}/verification", scope: "setup", ownership: "environment", effect: "request", mcp: "full", release: "A",
    summary: "Run supported harmless checks. Unsupported checks are reported as unsupported, never as passed.", params: companyEnv,
    body: z.object({ targets: z.array(z.enum(["credentials", "providers", "slack", "messenger"])).min(1).max(4) }).strict() },

  // Release B: company-owned operational data.
  { id: "cases.list", method: "GET", path: "/companies/{company}/environments/{environment}/cases", scope: "cases.read", ownership: "environment", effect: "read", mcp: "full", release: "B",
    summary: "List company-owned cases or conversations with emotion filters (sentiment: happy, neutral, upset, angry, sad, mixed or unknown), a customer filter (customer: paid for a captured or authorized live payment, no_purchase for a matched contact who has not paid, unmatched for an unknown sender), ordering (sort, including customer_message for the latest customer message first), page size, coverage and a cursor. Operational rows include conversationSentiment (label, confidence, evidence references, source, assessed_at and pending freshness). Operational filters require the company's operational connection; Messenger-only results include coverage limits.", params: companyEnv,
    query: caseListQuery },
  { id: "cases.search", method: "GET", path: "/companies/{company}/environments/{environment}/cases/search", scope: "cases.read", ownership: "environment", effect: "read", mcp: "full", release: "B",
    summary: "Find cases by customer name, email, phone, date of birth, support code, order or tracking number, vendor or Stripe ID, or message words, with status and date filters. Returns one current workspace per verified customer (explicit splits stay separate), with the actual ticket code, all issue references, plan and run progress, orders and message excerpts. Message case_id opens the workspace; source_case_id retains the original issue. Search matches are leads, not proof of identity or completed work.", params: companyEnv,
    query: caseSearchQuery },
  { id: "cases.get", method: "GET", path: "/companies/{company}/environments/{environment}/cases/{case}", scope: "cases.read", ownership: "environment", effect: "read", mcp: "full", release: "B",
    summary: "Read one case or conversation with its original messages and related records. Operational records include workspace with the current customer ticket and all owned issue references, plus the shared saved timeline, including original inbound phone transcripts, caller-supplied pharmacy intake and private tool receipts with attempts and results. Generated speech is not proof the caller heard it; saved intake is not resolution. The conversation field includes messages, other_threads and activity from the same case feed: original email From/To headers, Slack sender/channel, and care routing audience/direction/endpoints when recorded. Missing headers stay unknown; routing is display evidence, never reply authorization. The original case identity is retained. Includes conversationSentiment with happy, neutral, upset, angry, sad, mixed or unknown, confidence, exact evidence references, source, assessed_at and pending freshness; an estimate does not prove resolution. contact_sources lists each name, email and phone with its source (account, staff-saved or the website chat form) and a plain note; chat form details are self-reported, never identity proof or a reply address. Each customer_records.orders item has supply: paid plan months, each product's package days, the newest prescriptions with quantity, refills and days per fill (with its source), the shipment sequence of a split plan and a plain summary; unavailable:true means unknown, not none. Supply facts never give dosing.", params: caseParams,
    query: z.object({ after: z.coerce.number().int().min(0).optional() }).strict() },
  { id: "cases.attachment", method: "GET", path: "/companies/{company}/environments/{environment}/cases/{case}/attachments/{attachment}", scope: "cases.read", ownership: "environment", effect: "read", mcp: "full", release: "B",
    summary: "Get a short-lived download for an attachment that belongs to this case.", params: caseParams.extend({ attachment: uuid }).strict() },
  { id: "cases.account", method: "GET", path: "/companies/{company}/environments/{environment}/cases/{case}/account", scope: "cases.read", ownership: "environment", effect: "read", mcp: "full", release: "B",
    summary: "Read the case customer's subscriptions and upcoming shipments, the same account facts used by the chat agent and Details panel: renewal and next-charge dates, recurring price/currency, pauses and scheduled ends, refill due dates and prepaid fills, fulfillment and tracking. Planned dates are not confirmed ship dates. Read coverage distinguishes unknown from absent; no customer changes are made.", params: caseParams },
  { id: "cases.customer_profile", method: "GET", path: "/companies/{company}/environments/{environment}/cases/{case}/customer-profile", scope: "cases.read", ownership: "environment", effect: "read", mcp: "full", release: "B",
    summary: "Read the case customer's profile: name, date of birth, contact details, default shipping and billing addresses, each order's addresses and earlier addresses. A saved address does not prove where an existing order ships.", params: caseParams },
  { id: "investigations.list", method: "GET", path: "/companies/{company}/environments/{environment}/cases/{case}/investigations", scope: "cases.read", ownership: "environment", effect: "read", mcp: "full", release: "B",
    summary: "Read shared investigation runs, saved plans, approval state and execution receipts across the verified customer’s cases, including historical issues. Each run retains its original support_case_id; use that ID for write operations and original run evidence.", params: caseParams },
  { id: "runs.list", method: "GET", path: "/companies/{company}/environments/{environment}/runs", scope: "cases.read", ownership: "environment", effect: "read", mcp: "full", release: "B",
    summary: "List investigation and execution runs across cases, newest first, with status, plan approval and date filters.", params: companyEnv,
    query: runsQuery },
  { id: "plans.list", method: "GET", path: "/companies/{company}/environments/{environment}/plans", scope: "cases.read", ownership: "environment", effect: "read", mcp: "full", release: "B",
    summary: "List published plans, newest first: who approved each (a person or an agent), whether it ran and was checked, the agent's self-review, its own call on running the plan without approval, and auto_run: what the channel's auto-run setting did or would do with it (outcome ran/would_run/would_wait, the deciding reason, channel, on/off, confidence bar and any saved auto-run decision), and runs_as: code when approved work runs, or ran, without an agent (a plan that only resolves the case, or sends one reply and then resolves it), otherwise agent. Includes totals comparing the agent's calls with people's decisions. Read-only.", params: companyEnv,
    query: plansQuery },
  { id: "investigations.request", method: "POST", path: "/companies/{company}/environments/{environment}/cases/{case}/investigations", scope: "investigations.request", ownership: "environment", effect: "request", mcp: "full", release: "B",
    summary: "Ask Summer to investigate the case, or revise a saved plan with feedback. The new plan follows the company's auto-run rules; to make every plan wait for a person, turn auto-run off in the execution policy. Guidance and feedback apply to this request only; later plans read them as past context. Set guidance_scope to standing for an instruction that applies to every later plan for this customer.", params: caseParams,
    body: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("investigate"), guidance:operatorGuidance.optional(), guidance_scope: guidanceScope.optional().describe("request (default): this request only. standing: every later plan for this customer. Ignored without guidance.") }).strict(),
      z.object({ kind: z.literal("revise"), plan_request_id: uuid, feedback: operatorGuidance.min(1), guidance_scope: guidanceScope.optional().describe("request (default): this revision only. standing: every later plan for this customer.") }).strict(),
    ]) },

  { id: "cases.chat.list", method: "GET", path: "/companies/{company}/environments/{environment}/cases/{case}/chat", scope: "cases.read", ownership: "environment", effect: "read", mcp: "full", release: "B",
    summary: "Read the case chat with Summer: each question people asked about the case, oldest first, with its status and Summer's saved answer (the latest 10). An answer is Summer's explanation of its own work, not new evidence, approval or a customer outcome.", params: caseParams },
  { id: "cases.chat.ask", method: "POST", path: "/companies/{company}/environments/{environment}/cases/{case}/chat", scope: "investigations.request", ownership: "environment", effect: "request", mcp: "full", release: "B",
    summary: "Ask Summer a question about the case, such as why it chose a plan or what it found. Summer reopens its last run on the case, with what it already read, and answers in the case chat. Read-only: it publishes no plan and makes no changes. One question at a time per case. Read cases.chat.list for the answer, which usually takes a minute or two. To change the plan, use investigations.request.", params: caseParams,
    body: z.object({ question: z.string().trim().min(1).max(4000) }).strict() },

  { id: "investigations.stop", method: "POST", path: "/companies/{company}/environments/{environment}/cases/{case}/investigations/{run}/stop", scope: "investigations.request", ownership: "environment", effect: "write", mcp: "full", release: "B",
    summary: "Stop an exact investigation owned by this case, preserving its evidence and history. Cannot stop execution runs. A stop request is not a finished cancellation: read investigations.list until the run is cancelled or completed, then use investigations.request with current guidance to rerun.",
    params: caseParams.extend({ run: uuid }).strict(), body: z.object({}).strict() },

  { id: "investigations.plan.edit", method: "POST", path: "/companies/{company}/environments/{environment}/cases/{case}/investigations/{request}/wording", scope: "investigations.request", ownership: "environment", effect: "write", mcp: "full", release: "B",
    summary: "Edit wording in the current saved plan at its expected revision, including proposed company knowledge text. Preserves targets, amounts, feedback sources and selected option. Invalidates prepared approval; does not apply knowledge or customer changes.",
    params: caseParams.extend({ request: uuid }).strict(), body: z.object({
      expected_revision: z.number().int().nonnegative(),
      edits: z.record(z.string().regex(/^(?:task|\d+\.(?:subject|text|body|content))$/), z.string().max(100000)).refine(value => Object.keys(value).length > 0 && Object.keys(value).length <= 100, "Supply between 1 and 100 existing wording fields."),
      reason: z.string().trim().min(1).max(1000),
    }).strict() },

  // Release C: exact approved execution through the existing boundary.
  { id: "actions.prepare", method: "POST", path: "/companies/{company}/environments/{environment}/cases/{case}/actions/prepare", scope: "actions.prepare", ownership: "environment", effect: "request", mcp: "full", release: "C",
    summary: "Prepare the exact current plan and return its execution ID, approval hash and reviewed work. Does not approve or execute. A delegated actions.approve grant can approve authorized work through API, CLI or MCP.", params: caseParams,
    body: z.object({ plan_request_id: uuid, replaces_execution: uuid.optional().describe("Replace an unapproved, unstarted queued execution whose source or selected plan changed. Existing approvals and uncertain work cannot be replaced.") }).strict() },
  { id: "actions.approve", method: "POST", path: "/companies/{company}/environments/{environment}/cases/{case}/actions/approve", scope: "actions.approve", ownership: "environment", effect: "request", mcp: "full", release: "C",
    summary: "Approve the exact prepared execution under the authenticated operator's delegated authority. Use only for work the operator authorized, read the prepared review first, and pass its exact hash. Records the authorization and queues ordinary execution; approval does not prove a customer outcome. No caller-supplied approver identity or identity-verification attestation.", params: caseParams,
    body: z.object({ execution: uuid, approval_hash: z.string().regex(/^[a-f0-9]{64}$/), authorization: z.string().trim().min(1).max(2000).describe("The operator's instruction authorizing this exact work, retained in the approval audit. This is context, not an identity attestation.") }).strict() },
  { id: "actions.retry", method: "POST", path: "/companies/{company}/environments/{environment}/cases/{case}/actions/retry", scope: "actions.approve", ownership: "environment", effect: "request", mcp: "full", release: "C",
    summary: "Try a saved plan approval again when it is waiting to start (its id is in investigations.list planApprovals). Returns the approval's current state and the reason when it still cannot start. start_anyway ends the case's stopped runs that have no checked result, recording this person, so the approved plan starts; an earlier run may already have made its changes. A run still working keeps blocking.", params: caseParams,
    body: z.object({ approval: uuid, start_anyway: z.literal(true).optional().describe("The operator chose to start even though an earlier run stopped without a checked result."),
      authorization: z.string().trim().min(1).max(2000).describe("The operator's instruction to retry, retained in the audit event. This is context, not an identity attestation.") }).strict() },

  // Release D: automation.
  { id: "events.list", method: "GET", path: "/companies/{company}/environments/{environment}/events", scope: "setup", alsoScope: "events.read", ownership: "environment", effect: "read", mcp: "full", release: "D",
    summary: "Read configuration and activity events after a cursor. Pagination uses next_cursor.", params: companyEnv,
    query: z.object({ after: z.string().regex(/^\d{1,18}$/).optional(), limit: z.coerce.number().int().min(1).max(200).optional() }).strict() },
  { id: "service_accounts.list", method: "GET", path: "/companies/{company}/service-accounts", scope: "automation.manage", ownership: "company", effect: "read", mcp: "full", release: "D",
    summary: "List the company's service accounts.", params: companyOnly },
  { id: "service_accounts.save", method: "PUT", path: "/companies/{company}/service-accounts/{account}", scope: "automation.manage", ownership: "company", effect: "secret_write", mcp: "handoff", release: "D",
    summary: "Create, update, rotate or disable a service account. A new secret goes to the trusted local helper only.",
    params: companyOnly.extend({ account: uuid }).strict(),
    body: z.object({ name: z.string().trim().min(1).max(80), environments: z.array(schemas.environment).min(1).max(2), scopes: z.array(z.enum(SERVICE_SCOPES)).min(1).max(2),
      expected_version: schemas.version, rotate_secret: z.boolean().default(false), disable: z.boolean().default(false) }).strict() },
  { id: "webhooks.list", method: "GET", path: "/companies/{company}/environments/{environment}/webhooks", scope: "automation.manage", ownership: "environment", effect: "read", mcp: "full", release: "D",
    summary: "List webhook endpoints and delivery state.", params: companyEnv },
  { id: "webhooks.save", method: "PUT", path: "/companies/{company}/environments/{environment}/webhooks/{webhook}", scope: "automation.manage", ownership: "environment", effect: "secret_write", mcp: "handoff", release: "D",
    summary: "Create, update, rotate or disable a signed webhook endpoint. A new signing secret goes to the trusted local helper only.",
    params: companyEnv.extend({ webhook: uuid }).strict(),
    body: z.object({ url: z.string().url().max(512), event_types: z.array(z.string().regex(/^(\*|[a-z][a-z0-9_.]{2,80})$/)).min(1).max(32),
      expected_version: schemas.version, rotate_secret: z.boolean().default(false), disable: z.boolean().default(false) }).strict() },
  { id: "webhooks.replay", method: "POST", path: "/companies/{company}/environments/{environment}/webhooks/{webhook}/replay", scope: "automation.manage", ownership: "environment", effect: "request", mcp: "full", release: "D",
    summary: "Queue past events after a cursor for delivery again to one endpoint. Receivers deduplicate by event ID.",
    params: companyEnv.extend({ webhook: uuid }).strict(), body: z.object({ after: z.string().regex(/^\d{1,18}$/), limit: z.number().int().min(1).max(1000).default(200) }).strict() },
];

export const operationById = new Map(OPERATIONS.map(op => [op.id, op]));

/** Match "/companies/abc/..." to an operation and its raw path parameters. */
export function matchOperation(method: string, path: string): { op: Operation; params: Record<string, string> } | { allowed: string[] } | null {
  const parts = path.split("/").filter(Boolean);
  const allowed: string[] = [];
  for (const op of OPERATIONS) {
    const template = op.path.split("/").filter(Boolean);
    if (template.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < template.length && ok; i++) {
      const t = template[i];
      if (t.startsWith("{")) {
        try { params[t.slice(1, -1)] = decodeURIComponent(parts[i]); }
        catch { ok = false; }
      }
      else ok = t === parts[i];
    }
    if (!ok) continue;
    if (op.method === method) return { op, params };
    allowed.push(op.method);
  }
  return allowed.length ? { allowed } : null;
}

/** Operations whose success response carries a one-time secret for the local helper. */
export const ISSUES_SECRET = new Set(["messenger.installations.create", "messenger.installations.rotate_key", "service_accounts.save", "webhooks.save"]);
/** Whether this exact request issues a secret: creation, rotation, never disable or plain updates. */
export function issuesSecret(op: Operation, input: Record<string, unknown>) {
  if (op.id === "service_accounts.save" || op.id === "webhooks.save") return input.disable !== true && (input.expected_version === 0 || input.rotate_secret === true);
  return ISSUES_SECRET.has(op.id);
}

/** MCP tool name for an operation: "credentials.set" -> "summer_credentials_set". */
export const toolName = (op: Operation) => "summer_" + op.id.replace(/\./g, "_");
