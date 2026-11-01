import { z } from "zod";

// One action catalogue with three sources. Company actions are described in
// the database by the company's admins; Summer renders and checks them.
// See docs/design/summer-action-bindings/.

export const ACTION_SOURCES = ["built_in", "connector", "company"] as const;
export const ACTION_STAGES = ["off", "review", "automatic"] as const;
export const ACTION_RUNNERS = ["code", "http", "agent"] as const;
export type ActionStage = (typeof ACTION_STAGES)[number];
export type ActionSource = (typeof ACTION_SOURCES)[number];

export const companyActionKey = z.string().regex(/^company\.[a-z0-9][a-z0-9-]{1,62}$/, "Use company. followed by lowercase letters, numbers and hyphens.");
/** The values a use of a company action supplies for its declared inputs. The
 * definition's input types are checked when the use is rendered. */
export const companyActionInputValues = z.record(z.string(), z.union([z.string().max(4000), z.number(), z.boolean(),
  z.array(z.unknown()).max(200), z.record(z.string(), z.unknown())])).default({});
export const actionKey = z.string().regex(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/).max(120);
const inputName = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/);
// Any credential the company saved in Summer. Summer adds it at send time; the
// agent never sees it, and a person sees its name and host before first use.
const credentialName = z.string().regex(/^[A-Z][A-Z0-9_]{1,127}$/, "Use the saved credential name, such as ERP_API_TOKEN.");

/** A small, safe subset of JSON Schema for the inputs the agent supplies. */
// Lists and objects fill a whole JSON or form body value, such as line items.
const inputProperty = z.object({
  type: z.enum(["string", "number", "integer", "boolean", "array", "object"]),
  description: z.string().max(300).optional(),
  enum: z.array(z.union([z.string().max(200), z.number()])).min(1).max(50).optional(),
  pattern: z.string().max(200).refine(p => { try { new RegExp(p); return true; } catch { return false; } }, "Use a valid regular expression.").optional(),
  minLength: z.number().int().min(0).max(4000).optional(),
  maxLength: z.number().int().min(1).max(4000).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
}).strict();
export const actionInputsSchema = z.object({
  type: z.literal("object"),
  required: z.array(inputName).max(20).default([]),
  properties: z.record(inputName, inputProperty).refine(p => Object.keys(p).length <= 20, "Use at most 20 inputs."),
}).strict().superRefine((schema, ctx) => {
  for (const name of schema.required) if (!schema.properties[name]) ctx.addIssue({ code: "custom", path: ["required"], message: `${name} is required but not defined.` });
});
export type ActionInputs = z.infer<typeof actionInputsSchema>;

const httpsOrigin = z.string().url().max(200).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value && publicHostname(url.hostname);
  } catch { return false; }
}, "Use an https origin with a public host name, such as https://api.example.com.");

/** Refuse IP literals and local or private names; DNS names only. */
export function publicHostname(host: string) {
  const h = host.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(h) || !h.includes(".") || /^[0-9.]+$/.test(h) || h.startsWith("[")) return false;
  return !(h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan") || h.endsWith(".home.arpa"));
}

const FORBIDDEN_HEADERS = /^(authorization|cookie|set-cookie|host|content-length|transfer-encoding|connection|proxy-.*|x-forwarded-.*|x-real-ip)$/i;
const templateString = z.string().max(2000);
type JsonTemplate = string | number | boolean | null | JsonTemplate[] | { [key: string]: JsonTemplate };
const jsonTemplate: z.ZodType<JsonTemplate> = z.lazy(() => z.union([templateString, z.number(), z.boolean(), z.null(), z.array(jsonTemplate).max(50), z.record(z.string().max(80), jsonTemplate)]));

export const actionLimitsSchema = z.object({
  audience: z.enum(["customer", "partner", "internal", "none"]),
  channel: z.enum(["chat", "email", "sms", "slack", "voice", "api", "browser"]).optional(),
  allowedOrigins: z.array(httpsOrigin).max(10).default([]),
}).strict();
export type ActionLimits = z.infer<typeof actionLimitsSchema>;

export const httpRequestTemplateSchema = z.object({
  method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
  origin: httpsOrigin,
  path: z.string().min(1).max(500).regex(/^\/[^?#\s]*$/, "Start the path with / and leave out the query string."),
  query: z.record(z.string().regex(/^[a-zA-Z0-9_.-]{1,60}$/), templateString).optional(),
  headers: z.record(z.string().regex(/^[a-zA-Z0-9-]{1,60}$/), templateString).optional()
    .refine(h => !h || Object.keys(h).every(name => !FORBIDDEN_HEADERS.test(name)), "Set authentication with auth, not a header."),
  body: jsonTemplate.optional(),
  auth: z.discriminatedUnion("scheme", [
    z.object({ scheme: z.literal("none") }).strict(),
    z.object({ scheme: z.literal("bearer"), credential: credentialName }).strict(),
    z.object({ scheme: z.literal("header"), credential: credentialName, header: z.string().regex(/^[a-zA-Z0-9-]{1,60}$/).refine(n => !FORBIDDEN_HEADERS.test(n) || /^authorization$/i.test(n)) }).strict(),
    z.object({ scheme: z.literal("basic"), credential: credentialName }).strict(),
    // OAuth2 client credentials: Summer gets a token from tokenPath on the same
    // host, then sends it as a bearer token. Neither secret reaches the agent.
    z.object({ scheme: z.literal("oauth2_client_credentials"), tokenPath: z.string().min(1).max(300).regex(/^\/[^?#\s]*$/),
      clientIdCredential: credentialName, clientSecretCredential: credentialName, scope: z.string().max(500).optional() }).strict(),
  ]),
  successStatus: z.array(z.number().int().min(200).max(299)).min(1).max(10).default([200, 201, 202, 204]),
  bodyEncoding: z.enum(["json", "form"]).default("json").describe("form sends application/x-www-form-urlencoded, as Stripe- and Twilio-style APIs expect."),
  idempotencyHeader: z.string().regex(/^[a-zA-Z0-9-]{1,60}$/).optional()
    .describe("Header Summer fills with a stable ID for this exact use, such as Idempotency-Key, so the API can ignore a repeat."),
  expect: z.object({
    path: z.string().regex(/^[a-zA-Z0-9_$-]+(\.[a-zA-Z0-9_$-]+)*$/).max(200).describe("Dot path into the JSON response, such as data.status"),
    equals: z.union([z.string().max(200), z.number(), z.boolean()]).optional().describe("Leave out to require only that the field exists"),
  }).strict().optional().describe("A response field that must match for the use to count as done."),
}).strict();
export type HttpRequestTemplate = z.infer<typeof httpRequestTemplateSchema>;

const common = {
  key: companyActionKey,
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  inputs: actionInputsSchema,
  limits: actionLimitsSchema,
  verification: z.string().trim().min(3).max(1000),
  sensitive: z.array(z.enum(["money", "identity", "clinical"])).max(3)
    .describe("What the action does that always needs a person: moves money, changes identity, or clinical work. Give [] when it does none of these. Any value makes every use wait for a person."),
};
export const companyActionDefinitionSchema = z.discriminatedUnion("runner", [
  z.object({ ...common, runner: z.literal("http"), request: httpRequestTemplateSchema }).strict(),
  z.object({ ...common, runner: z.literal("agent"), instructions: z.string().trim().min(20).max(8000), evidence: z.string().trim().min(3).max(1000) }).strict()
    .refine(d => d.limits.channel !== "browser" || d.limits.allowedOrigins.length > 0, { message: "List the websites this task may use.", path: ["limits", "allowedOrigins"] }),
]).superRefine((definition, ctx) => {
  // Every placeholder must name a declared input.
  const names = new Set(Object.keys(definition.inputs.properties));
  const text = definition.runner === "http" ? JSON.stringify(definition.request) : definition.instructions;
  for (const match of text.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g))
    if (!names.has(match[1])) ctx.addIssue({ code: "custom", path: [definition.runner === "http" ? "request" : "instructions"], message: `{{${match[1]}}} is not a declared input.` });
});
export type CompanyActionDefinition = z.infer<typeof companyActionDefinitionSchema>;

export const actionStageUpdateSchema = z.object({
  stage: z.enum(ACTION_STAGES),
  described_accepted: z.boolean().optional(),
  daily_limit: z.number().int().min(1).max(1000).nullable().optional(),
  reason: z.string().trim().min(3).max(500),
  expected_version: z.number().int().min(0),
}).strict();

/** Use of one action over the last 30 days. See summer_action_track_record. */
export const trackRecordSchema = z.object({
  proposed: z.number().int(), approved_unchanged: z.number().int(), agent_would_run_unchanged: z.number().int(),
  changed_or_dismissed: z.number().int(), ran: z.number().int(), uncertain: z.number().int(), checked: z.number().int(),
  ran_on_its_own: z.number().int(), last_ten_clean: z.boolean(), runs_today: z.number().int(),
});
export type TrackRecord = z.infer<typeof trackRecordSchema>;
