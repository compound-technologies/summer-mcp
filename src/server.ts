// Summer MCP server: stateless Streamable HTTP with JSON responses.
// Tools are generated from the same operation catalog and call the same
// execute() as the API. The server cannot read the client's local files or
// environment variables. Operations that would place a secret in model-visible
// output return a handoff to the trusted local Summer CLI instead.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Server, createMcpHandler, isLegacyRequest, isJsonContentType, readRequestBody,
  WebStandardStreamableHTTPServerTransport, ProtocolError, ProtocolErrorCode, ResourceNotFoundError, type Tool as McpTool, type CallToolResult } from "@modelcontextprotocol/server";
import { ApiError, HUMAN_ONLY, issuesSecret, MCP_PROTOCOL_VERSIONS, OPERATIONS, toolName, type Operation } from "./contract.ts";
import type { McpAdmission, McpBackend, McpConfig } from "./backend.ts";
import { MCP_VERSION, MINIMUM_CLI_VERSION, CLIENT_STATUS_META, clientStatus, requestClientStatus } from "./client-status.ts";

const SETUP_PROMPT = { name: "summer_setup", title: "Set up Summer in this project", description: "The reviewed agent setup guide, with your company and environment filled in. It uses the local Summer CLI for any step that moves a secret.",
  arguments: [{ name: "company", description: "Summer company ID from this connection", required: false }, { name: "environment", description: "staging (default) or production", required: false }] };

const SERVER = { name: "summer", title: "Summer", version: MCP_VERSION };
const INSTRUCTIONS = `Summer company setup and case tools. Public discovery lists tool schemas only. Every tool call requires a Summer OAuth access token; a 401 response points to the authorization metadata. Start with summer_account_me and summer_company_capabilities.

Version check: this live Summer MCP catalog is ${MCP_VERSION} and needs Summer CLI ${MINIMUM_CLI_VERSION} or newer. Normal tool responses include client-status metadata and readable update warnings alongside the requested data. Continue an otherwise valid request even when the client is old; warnings never require a retry or block work. A last check older than seven days produces an advisory; it does not block the result. No separate version check is required before a normal call. Use summer_client_status with your cached mcp_version, cli_version and last_checked_at for explicit diagnostics, especially after a missing command/tool or schema mismatch. Run summer version --check --json to compare the installed CLI with the published npm release; update an old CLI with npm install -g @gosummerai/cli@latest. Refresh MCP initialization and tools/list after a version change using the saved OAuth connection; no new login or permission is needed. Retain client registration and refresh credentials across software updates. The hosted server updates centrally; this server cannot inspect your local installation or cached tool list. A stale check is a reminder to verify, not proof that software is obsolete. Missing scopes require normal Summer consent, preserving existing grants; a software update grants no permissions.

Write for the intended reader: customers for public guides and staff for internal procedures. Follow ASD-STE100 about 80%. Use short sentences, active voice, one idea per sentence and consistent terms. Avoid metaphors and technical slang. Keep necessary facts and uncertainty.
Customize welcome copy, home/chat buttons and lead fields through installation settings.presentation. Website buttons open HTTPS links; lead_capture buttons open the consent form. Read the issuer's /docs/messenger-leads guide. Saved submissions emit messenger.lead.submitted through the existing signed webhooks, including the company and installation IDs. Webhook setup needs automation.manage. Read leads with cases.read. Booking handoff codes expire after 15 minutes and require the selected company's server to exchange them. Never treat contact details as account identity or claim a saved lead is a confirmed booking.
Read the issuer's /docs/support-email guide before configuring support email. Identify the support address, mail provider, receiving inbox and permitted sender. Test reading, sending and DNS separately. Intercom's account check does not test inbox access or replies. This catalog has help-desk setup and credential storage. It has no direct Gmail/Outlook connector or email DNS commands. Use an existing authorized help-desk API or browser workflow when available. Saved credentials and custom integration definitions do not establish a working connection. Record test results, original message references, check times and missing steps in capability checks. Follow the company's reply and approval rules. Help-center DNS configures website addresses, not email. Keep website conversations in chat unless the visitor wants email follow-up. Contact capture does not send email.
Read operational_readiness or summer_capability_checks_list for the same checklist shown in Summer. Fulfill tasks through discoverable APIs, browsers, current knowledge or combined paths. Upload relevant knowledge, configure integrations and record evidence with summer_capability_checks_report; add useful business-specific expectations with summer_capability_checks_save. A saved credential or guide alone does not prove a working path. Setup-agent reports never imply human approval or independently verified execution.
Report saved, verified, pending, unavailable and enabled states exactly as returned; saved is not verified.
When someone asks about a customer, support ticket, order or customer problem, look it up in Summer before you investigate on your own. Use summer_cases_search with a name, email, phone, date of birth, support code, order or tracking number, vendor ID, message words or dates. Then read summer_cases_get, summer_cases_customer_profile and summer_investigations_list for the case's messages, saved plans, approvals and receipts. summer_runs_list shows recent investigations and executions across cases. Start from Summer's evidence and investigate only what it does not answer. Search results are leads, not identity proof. If this project's agent instructions (for example AGENTS.md or CLAUDE.md) do not already say to check Summer first, suggest a short rule that does. Add it only when the person agrees, and add to the file rather than replace it.
Never ask a person to paste a secret into chat. Secret values, signing keys and service account secrets move only through the local Summer CLI; tools that would need one return a handoff command.
An approved setup connection includes installing and enabling Messenger in its selected companies and environments, including production, within current budgets. Complete requested setup without asking for the same permission again or escalating installation to another agent. A local CLI handoff is a trusted secret-transfer step: run it locally when available, keeping keys out of model-visible output. Ask only for genuinely missing company/environment access or authority. This does not grant business-effect approval or investigation authority.\nCompany settings and knowledge are company-wide. Credentials, Messenger installations and cases belong to one environment.
Author company guidebooks with summer_guides_get, summer_guides_save and summer_guides_articles_save. Upload media metadata with summer_assets_uploads_create, then transfer the selected local file with the returned CLI command; never send base64 or binary through tools. Use native tools for writing, real screenshots and optional image/video creation. Preview the exact article revisions before summer_guides_publish, which needs guides.publish authority. Published customer URLs and internal knowledge citations have different audiences. Investigators, executors and conversational agents reference the same published company articles; a guide never proves a customer action completed.
These are never available to an agent: ${HUMAN_ONLY.join("; ")}.`;

type Tool = { op: Operation; name: string; schema: z.ZodObject<z.ZodRawShape>; handoff: boolean };
function toolFor(op: Operation): Tool | null {
  if (op.mcp === "none") return null;
  const shape: z.ZodRawShape = { ...(op.params?.shape ?? {}), ...(op.query?.shape ?? {}) };
  if (op.id === "credentials.set") {
    // Only references cross MCP. Values go through the local CLI.
    Object.assign(shape, {
      source: z.enum(["doppler", "local_value"]).describe("doppler saves a reference; local_value returns a CLI handoff"),
      secret_name: z.string().regex(/^[A-Z][A-Z0-9_]{0,127}$/).optional().describe("Doppler secret name, for source=doppler"),
      expected_version: z.number().int().min(0),
    });
  } else if (op.body instanceof z.ZodObject) Object.assign(shape, op.body.shape);
  else if (op.body) Object.assign(shape, { request: op.body });
  if (op.effect !== "read") Object.assign(shape, { idempotency_key: z.string().regex(/^[A-Za-z0-9_.:-]{8,128}$/).optional().describe("Reuse the same key when retrying the same change") });
  return { op, name: toolName(op), schema: z.object(shape).strict(), handoff: op.mcp === "handoff" };
}
export const TOOLS = OPERATIONS.map(toolFor).filter((t): t is Tool => t !== null);

const json = (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
function visible(tool: Tool, admission: McpAdmission) {
  const { op } = tool;
  if (op.scope === null) return admission.principal.kind === "user";
  return admission.grant.scopes.includes(op.scope) || (op.alsoScope !== undefined && admission.grant.scopes.includes(op.alsoScope));
}
function describeTool(tool: Tool): McpTool {
  const { op } = tool;
  return {
    name: tool.name, title: op.summary.split(".")[0], description: op.summary + (tool.handoff ? " Returns a local CLI command when a secret is involved." : ""),
    inputSchema: json(tool.schema) as McpTool["inputSchema"],
    annotations: { title: op.summary.split(".")[0], readOnlyHint: op.effect === "read", destructiveHint: op.destructive ?? op.effect !== "read", idempotentHint: op.effect === "read", openWorldHint: true },
  };
}

const flag = (name: string, value: unknown) => value === undefined || value === null || value === "" ? [] : [`--${name}`, String(value)];
const shell = (args: string[]) => args.map(a => /^[A-Za-z0-9_./:=@-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`).join(" ");
/** The exact local command that completes this step without exposing a secret. */
export function cliHandoff(op: Operation, args: Record<string, unknown>, config: McpConfig) {
  const base = [...flag("company", args.company), ...flag("environment", args.environment)];
  const version = [...flag("expected-version", args.expected_version), ...(args.rotate_secret ? ["--rotate-secret"] : [])];
  const commands: Record<string, string[]> = {
    "credentials.set": ["summer", "credentials", "set", String(args.name), "--from-env", String(args.name), ...base, "--expected-version", String(args.expected_version ?? 0), "--json"],
    "messenger.installations.create": ["summer", "messenger", "create", ...base, ...flag("id", args.id), "--from-file", "summer.messenger.json", "--write-key-to", ".env.local:SUMMER_MESSENGER_SIGNING_KEY", "--json"],
    "messenger.installations.rotate_key": ["summer", "messenger", "rotate-key", String(args.installation), ...base, "--expected-version", String(args.expected_version), "--write-key-to", ".env.local:SUMMER_MESSENGER_SIGNING_KEY", "--json"],
    "service_accounts.save": ["summer", "service-accounts", "save", String(args.account), ...flag("company", args.company), "--name", String(args.name ?? ""), ...version,
      ...flag("scopes", Array.isArray(args.scopes) ? args.scopes.join(",") : undefined), ...flag("environments", Array.isArray(args.environments) ? args.environments.join(",") : undefined), "--write-secret-to", ".env.local:SUMMER_SERVICE_ACCOUNT_SECRET", "--json"],
    "webhooks.save": ["summer", "webhooks", "save", String(args.webhook), ...base, "--url", String(args.url ?? ""), ...version,
      ...flag("events", Array.isArray(args.event_types) ? args.event_types.join(",") : undefined), "--write-secret-to", ".env.local:SUMMER_WEBHOOK_SECRET", "--json"],
  };
  const command = commands[op.id] ?? ["summer", "help"];
  return {
    handoff: {
      reason: "This step moves a secret. Run it with the local Summer CLI so the value goes straight to the selected secret location and never appears in this conversation.",
      command: shell([...(config.cliInstall?.split(/\s+/) ?? ["summer"]), ...command.slice(1), "--api", config.apiOrigin, ...flag("idempotency-key", args.idempotency_key)]),
      ...(op.id === "messenger.installations.create" ? { input_file: { path: "summer.messenger.json", contents: args.settings } } : {}),
      note: "The CLI has its own connection: run summer login for this API address if needed. Review the destination file or variable first. The CLI prints metadata only.",
    },
    executed: false,
  };
}

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };
// Static protocol and catalog metadata only. No company read, prompt rendering
// or tool execution can enter through anonymous discovery. Supplied credentials
// are always checked, so expired/revoked tokens cannot fall back to anonymous.
const PUBLIC_DISCOVERY = new Set(["initialize", "notifications/initialized", "server/discover", "ping", "tools/list", "resources/list", "resources/templates/list", "prompts/list"]);
const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const toolError = (error: unknown, backend: Pick<McpBackend<McpAdmission>, "normalizeError">): CallToolResult => {
  const e = error instanceof ApiError ? error : backend.normalizeError(error);
  const payload = { error: { code: e.code, message: e.message, retryable: e.retryable, ...(e.details ? { details: e.details } : {}) } };
  return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload, isError: true };
};

async function callTool<T extends McpAdmission>(request: Request, params: Record<string, unknown>, config: McpConfig, backend: McpBackend<T>, requestId: string): Promise<CallToolResult> {
  const tool = TOOLS.find(t => t.name === params.name);
  if (!tool) throw new ProtocolError(ProtocolErrorCode.InvalidParams, "Unknown Summer tool.");
  const parsed = tool.schema.safeParse(params.arguments ?? {});
  if (!parsed.success) return toolError(new ApiError("invalid_request", `Invalid argument ${parsed.error.issues[0]?.path.join(".") ?? ""}: ${parsed.error.issues[0]?.message ?? "invalid"}.`), backend);
  const args = parsed.data as Record<string, unknown>;
  const { op } = tool;
  try {
    const company = typeof args.company === "string" ? args.company : null;
    const admission = await backend.admit(request, company);
    // Secret-moving steps never execute over MCP. References and updates that
    // issue no secret still run normally.
    if ((op.id === "credentials.set" && args.source === "local_value") || issuesSecret(op, args)) {
      backend.authorize(admission, op, args);
      const result = cliHandoff(op, args, config);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    const pick = (schema: z.ZodObject<z.ZodRawShape> | undefined) => Object.fromEntries(Object.keys(schema?.shape ?? {}).filter(k => k in args).map(k => [k, args[k]]));
    const rawBody = op.id === "credentials.set" ? { source: "doppler", secret_name: args.secret_name, expected_version: args.expected_version }
      : op.body instanceof z.ZodObject ? pick(op.body) : op.body ? args.request : undefined;
    const result = await backend.execute({ admission, op, requestId, params: pick(op.params), query: pick(op.query), body: rawBody, idempotencyKey: typeof args.idempotency_key === "string" ? args.idempotency_key : null });
    delete result.body.one_time_secret; // Defense in depth: no secret path reaches here.
    return { content: [{ type: "text", text: JSON.stringify(result.body) }], structuredContent: result.body };
  } catch (error) {
    if (backend.isAuthenticationRequired(error) || (error instanceof ApiError && error.code === "insufficient_scope")) throw error;
    return toolError(error, backend);
  }
}

// Remote Summer is a public, bearer-only service: any HTTPS web client may
// connect with its own grant. Local development accepts only loopback origins.
// Host validation prevents a public origin policy from enabling DNS rebinding.
class InvalidOrigin extends Error {}
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
function browserOrigin(request: Request, config: McpConfig): string | null {
  const target = new URL(request.url);
  const hosts = new Set([new URL(config.apiOrigin).host, new URL(config.issuerOrigin).host, config.deploymentHost].filter(Boolean));
  if (!hosts.has(target.host) || (request.headers.has("host") && !hosts.has(request.headers.get("host")!))) throw new InvalidOrigin("This host is not allowed.");
  const value = request.headers.get("origin");
  if (value === null) return null;
  let origin: URL;
  try { origin = new URL(value); } catch { throw new InvalidOrigin("This origin is not allowed."); }
  const local = LOOPBACK.has(origin.hostname);
  if (origin.origin !== value || origin.username || origin.password ||
      (origin.protocol !== "https:" && !(origin.protocol === "http:" && local)) ||
      (LOOPBACK.has(target.hostname) && !local)) throw new InvalidOrigin("This origin is not allowed.");
  return value;
}
const CORS_HEADERS = ["authorization", "content-type", "mcp-protocol-version", "mcp-method", "mcp-name", "mcp-session-id", "last-event-id", "summer-cli-version", "summer-mcp-version", "summer-last-checked-at"];
function finish(response: Response, origin: string | null, requestId: string) {
  const outgoing = new Headers(response.headers);
  outgoing.set("Cache-Control", "private, no-store");
  outgoing.set("X-Content-Type-Options", "nosniff");
  outgoing.set("Summer-Request-Id", requestId);
  if (origin) {
    outgoing.set("Access-Control-Allow-Origin", origin);
    outgoing.append("Vary", "Origin");
    outgoing.set("Access-Control-Expose-Headers", "WWW-Authenticate, Retry-After, Summer-Request-Id, MCP-Protocol-Version");
  }
  return new Response(response.body, { status: response.status, headers: outgoing });
}

export async function handleMcp<T extends McpAdmission>(request: Request, config: McpConfig, backend: McpBackend<T>): Promise<Response> {
  const requestId = randomUUID();
  let origin: string | null = null;
  let requiredScope: string | null = null;
  const done = (response: Response) => finish(response, origin, requestId);
  if (!config.enabled) return done(Response.json({ error: "The Summer MCP server is not enabled on this deployment." }, { status: 404 }));
  try {
    origin = browserOrigin(request, config);
    if (request.method === "OPTIONS") {
      const method = request.headers.get("access-control-request-method");
      const requested = (request.headers.get("access-control-request-headers") ?? "").toLowerCase().split(",").map(h => h.trim()).filter(Boolean);
      if ((method && method !== "POST") || requested.some(h => !CORS_HEADERS.includes(h)))
        return done(new Response(null, { status: 403 }));
      return done(new Response(null, { status: 204, headers: { "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": CORS_HEADERS.join(", "), "Access-Control-Max-Age": "600" } }));
    }
    if (request.method !== "POST") return done(new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS" } }));
    if (!isJsonContentType(request.headers.get("content-type"))) return done(Response.json(rpcError(null, -32600, "Send Content-Type: application/json."), { status: 415 }));
    const body = await readRequestBody(request, 1_200_000);
    if (body.tooLarge) return done(Response.json(rpcError(null, -32600, "Request too large."), { status: 413 }));
    let message: RpcRequest;
    try { message = JSON.parse(body.text); } catch { return done(Response.json(rpcError(null, -32700, "Parse error."), { status: 400 })); }
    // This gate admits only static metadata. The SDK validates the entire wire
    // message (including metadata mirrors) before dispatching any handler.
    requiredScope = message?.method === "tools/call" ? TOOLS.find(t => t.name === message.params?.name)?.op.scope ?? null : null;
    const anonymous = !request.headers.has("authorization") && PUBLIC_DISCOVERY.has(message?.method);
    const admission = anonymous ? null : await backend.admit(request, null);
    const slow = await backend.rateLimit(admission ? admission.grant.id : `discovery:${backend.clientAddress(request)}`);
    if (!slow.allowed) return done(Response.json(rpcError(message?.id, -32000, "Too many requests from this connection. Try again later."), { status: 429, headers: { "Retry-After": String(slow.retryAfter) } }));

    // Keep one catalog/executor and let the official SDK encode each era. A
    // fresh server per request retains stateless hosting and live grant checks.
    let authorizationError: ApiError | undefined;
    const factory = () => {
      const info = message.params?.clientInfo as { name?: unknown; version?: unknown } | undefined;
      const knownCli = info && ["summer-cli", "@gosummerai/cli"].includes(String(info.name)) && typeof info.version === "string" && /^\d+\.\d+\.\d+$/.test(info.version);
      const warning = knownCli ? clientStatus({ cli_version: info.version as string }).warnings.find(w => w.code === "cli_outdated") : undefined;
      const server = new Server(SERVER, { supportedProtocolVersions: [...MCP_PROTOCOL_VERSIONS], capabilities: { tools: {}, resources: {}, prompts: {} }, instructions: (warning ? `WARNING: ${warning.message}\n\n` : "") + INSTRUCTIONS });
      server.setRequestHandler("tools/list", async () => ({ tools: TOOLS.filter(t => !admission || visible(t, admission)).map(describeTool) }));
      server.setRequestHandler("tools/call", async ({ params }) => {
        const status = requestClientStatus(request, params);
        const advisory = (result: CallToolResult): CallToolResult => ({ ...result,
          _meta: { ...result._meta, [CLIENT_STATUS_META]: status },
          content: [...result.content, ...status.warnings.map(w => ({ type: "text" as const, text: `Summer update warning (${w.code}): ${w.message}` }))],
        });
        try { return advisory(await callTool(request, params, config, backend, requestId)); }
        catch (error) {
          if (!(error instanceof ApiError)) throw error;
          authorizationError = error;
          return advisory(toolError(error, backend));
        }
      });
      server.setRequestHandler("resources/list", async () => ({ resources: [] }));
      server.setRequestHandler("resources/templates/list", async () => ({ resourceTemplates: [] }));
      server.setRequestHandler("resources/read", async ({ params }) => { throw new ResourceNotFoundError(params.uri, "Summer publishes knowledge through its authorized tools."); });
      server.setRequestHandler("prompts/list", async () => ({ prompts: config.setupAvailable ? [SETUP_PROMPT] : [] }));
      server.setRequestHandler("prompts/get", async ({ params }) => {
        if (!config.setupAvailable || params.name !== SETUP_PROMPT.name) throw new ProtocolError(ProtocolErrorCode.InvalidParams, "Unknown prompt.");
        const args = params.arguments ?? {};
        if (args.environment && !["staging", "production"].includes(args.environment)) throw new ProtocolError(ProtocolErrorCode.InvalidParams, "Choose staging or production.");
        const environment = args.environment === "production" ? "production" : "staging";
        const company = typeof args.company === "string" && admission?.grant.companies.includes(args.company) ? args.company : undefined;
        return { description: SETUP_PROMPT.description, messages: [{ role: "user", content: { type: "text", text: backend.setupPrompt({ company, environment }) } }] };
      });
      return server;
    };
    let response: Response;
    if (await isLegacyRequest(request, message)) {
      const server = factory();
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 1_200_000 });
      try {
        await server.connect(transport);
        response = await transport.handleRequest(request, { parsedBody: message });
      } finally { await server.close(); }
    } else {
      const handler = createMcpHandler(factory, { legacy: "reject", maxRequestBodySize: 1_200_000 });
      try { response = await handler.fetch(request, { parsedBody: message }); }
      finally { await handler.close(); }
    }
    // Summer emits a single JSON result, so a live admission/scope refusal can
    // still become an HTTP OAuth challenge before the response is returned.
    if (authorizationError) return done(backend.errorResponse(authorizationError, requestId));
    return done(response);
  } catch (error) {
    if (backend.isAuthenticationRequired(error)) return done(Response.json({ error: "invalid_token", error_description: error instanceof Error ? error.message : "Provide a valid Summer access token." }, { status: 401, headers: { "WWW-Authenticate": backend.authenticateHeader() + (requiredScope ? `, scope="${requiredScope}"` : "") } }));
    if (error instanceof InvalidOrigin) return done(Response.json({ error: error.message }, { status: 403 }));
    return done(Response.json(rpcError(null, -32603, "Summer could not process the request."), { status: 500 }));
  }
}
