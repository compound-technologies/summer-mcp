import { z } from "zod";
import type { Operation } from "./contract.ts";
import { actionKey, actionStageUpdateSchema, companyActionInputValues, companyActionKey } from "./actions.ts";

// The action catalogue: built-in and connector actions in code, company actions
// written by the company's admins, and the stage of each (Off, Review,
// Automatic). See docs/design/summer-action-bindings/11-api-and-ui.md.
const params = z.object({ company: z.string().uuid(), environment: z.enum(["staging", "production"]) }).strict();
const companyKey = params.extend({ key: companyActionKey }).strict();
const base = "/companies/{company}/environments/{environment}/actions";
const common = { scope: "setup", ownership: "environment", mcp: "full", release: "A", params } as const;
const expected = z.number().int().min(0).describe("The version you read; 0 for a new action");
const reason = z.string().trim().min(3).max(500).describe("Why you are making this change. Kept in the history.");

export const ACTION_OPERATIONS: Operation[] = [
  { ...common, id: "actions.catalog.list", method: "GET", path: base, effect: "read",
    summary: "List every action Summer can use for this company, the hosts each saved credential may be sent to, and the partner contacts the company named: built-in actions, connector actions and the company's own actions. Each shows its stage (off, review or automatic), whether it can ever run without a person, and its track record over 30 days: proposals, unchanged approvals, runs, uncertain runs and runs without a person. Changes nothing." },
  { ...common, id: "actions.candidates.list", method: "GET", path: base + "/candidates", effect: "read",
    summary: "List approved work from the last 60 days that no catalogue action covers: free-form tasks and raw API calls, with how often each recurred. Each can become a company action with actions.company.from_run. Changes nothing." },
  { ...common, id: "actions.company.from_run", destructive: false, method: "POST", path: base + "/company/{key}/from-run", effect: "write", params: companyKey,
    summary: "Save one piece of approved work as a draft company action: the task's instructions, or the API call's method, path and body (give its https origin). Replace case details with inputs, test and publish it like any other action. Never publishes.",
    body: z.object({ job_id: z.string().uuid(), effect_id: z.string().uuid().optional(), origin: z.string().max(200).optional(), expected_version: expected }).strict() },
  { ...common, id: "actions.company.get", method: "GET", path: base + "/company/{key}", effect: "read", params: companyKey,
    summary: "Read one company action: its draft, published revision, revision history, stage and stage history." },
  { ...common, id: "actions.company.save", destructive: false, method: "PUT", path: base + "/company/{key}", effect: "write", params: companyKey,
    summary: "Create or edit a company action's draft with the expected version. An API action (runner http) names the request Summer sends: method, https host, path, body and the saved credential name. A task action (runner agent) describes work the agent does with its own tools, such as a procedure or a website task. The agent sees only published revisions. Saving never publishes.",
    body: z.object({ definition: z.record(z.string(), z.unknown()).describe("The action definition. Read docs/design/summer-action-bindings/05-company-actions.md for the fields."), expected_version: expected }).strict() },
  { ...common, id: "actions.company.test", method: "POST", path: base + "/company/{key}/test", effect: "read", params: companyKey,
    summary: "Render the draft or published action with example inputs: the exact request (without the credential) or the exact task text, plus any problems. Sends nothing and changes nothing.",
    body: z.object({ inputs: companyActionInputValues, use: z.enum(["draft", "published"]).default("draft") }).strict() },
  { ...common, id: "actions.company.publish", destructive: false, method: "POST", path: base + "/company/{key}/publish", effect: "write", params: companyKey,
    summary: "Publish the current draft as the next revision with the expected version. The agent can propose it from the next investigation. A new action starts at Review: a person approves each use until an admin moves it to Automatic.",
    body: z.object({ reason, expected_version: expected }).strict() },
  { ...common, id: "actions.company.retire", destructive: true, method: "POST", path: base + "/company/{key}/retire", effect: "write", params: companyKey,
    summary: "Remove a company action from the agent's catalogue with the expected version. Approved work that uses it stops before it starts. Revisions and history stay.",
    body: z.object({ reason, expected_version: expected }).strict() },
  { ...common, id: "credentials.scope.update", destructive: false, method: "PUT", path: "/companies/{company}/environments/{environment}/credentials/{name}/scope", effect: "write",
    params: params.extend({ name: z.string().regex(/^[A-Z][A-Z0-9_]{1,127}$/) }).strict(),
    summary: "Set the hosts company actions may send one saved credential to, with the expected version (0 when it has no scope yet). Use exact https hosts, or https://*.example.com for any subdomain. A key with no scope may be sent to any public https host. Never reads or changes the value.",
    body: z.object({ hosts: z.array(z.string().trim().min(9).max(200).describe("https://api.example.com or https://*.example.com")).min(1).max(20), reason, expected_version: expected }).strict() },
  { ...common, id: "partners.contacts.save", destructive: false, method: "PUT", path: "/companies/{company}/environments/{environment}/partners/contacts", effect: "write",
    summary: "Name an email address, an email domain or a Slack channel as a partner or as your own team. Summer then knows who vendor mail and Slack replies reach, so they can run on their own under the company policy instead of waiting as an unknown audience. Saving an existing entry changes its audience or label.",
    body: z.object({ kind: z.enum(["email", "email_domain", "slack_channel"]), value: z.string().trim().min(2).max(254).describe("ops@example.com, example.com or a Slack channel ID such as C0123ABCD"),
      audience: z.enum(["partner", "internal"]), label: z.string().trim().max(120).optional() }).strict() },
  { ...common, id: "partners.contacts.remove", destructive: true, method: "POST", path: "/companies/{company}/environments/{environment}/partners/contacts/{id}/remove", effect: "write",
    params: params.extend({ id: z.string().uuid() }).strict(),
    summary: "Remove a partner contact. Mail or Slack posts to it go back to an unknown audience. The entry and the reason stay in the history.",
    body: z.object({ reason }).strict() },
  { ...common, id: "actions.stage.update", destructive: false, method: "PUT", path: base + "/{key}/stage", effect: "write", params: params.extend({ key: actionKey }).strict(),
    summary: "Set one action's stage with the expected version: off (never proposed), review (a person approves each use) or automatic (may run without a person when the company policy and the agent's checks allow). Automatic needs a person's delegated messaging.activate grant. A task action at automatic also needs described_accepted: true. Money, identity, clinical and other person-only actions cannot be automatic. A failed or uncertain automatic run moves the action back to review on its own.",
    body: actionStageUpdateSchema },
];
