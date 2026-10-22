// Public installation reference only. This server has no account backend,
// company lookup, credential reader, arbitrary URL fetcher or write capability.
import { Server, createMcpHandler, isLegacyRequest, isJsonContentType, readRequestBody,
  WebStandardStreamableHTTPServerTransport, ProtocolError, ProtocolErrorCode, type Tool, type CallToolResult } from "@modelcontextprotocol/server";
import { MCP_PROTOCOL_VERSIONS } from "./contract.ts";

export const SETUP_DOCUMENTS = ["install-messenger", "verified-identity", "security-and-testing", "messenger-leads"] as const;
export type SetupDocument = typeof SETUP_DOCUMENTS[number];
export type PublicSetupBackend = {
  read(slug: SetupDocument): { title: string; description: string; body: string };
  rateLimit(request: Request): Promise<{ allowed: boolean; retryAfter: number }>;
};
const tools: Tool[] = [
  { name: "summer_docs_list", title: "List Summer setup guides", description: "List public Summer Messenger installation, identity, lead form and testing guides. No account or customer data is accessed.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { title: "List Summer setup guides", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { securitySchemes: [{ type: "noauth" }] } },
  { name: "summer_docs_get", title: "Read a Summer setup guide", description: "Read one current public Summer Messenger guide from an enumerated topic. Returns the official Markdown and citation URL; cannot read company knowledge or customer records.",
    inputSchema: { type: "object", properties: { topic: { type: "string", enum: [...SETUP_DOCUMENTS], description: "Public integration guide to read." } }, required: ["topic"], additionalProperties: false },
    annotations: { title: "Read a Summer setup guide", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { securitySchemes: [{ type: "noauth" }] } },
];
const result = (data: Record<string, unknown>): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data });
const invalid = () => { throw new ProtocolError(ProtocolErrorCode.InvalidParams, "Choose a listed public setup topic. Account data, paths and URLs are not accepted."); };

export async function handleDocumentationMcp(request: Request, backend: PublicSetupBackend): Promise<Response> {
  let origin: string | null = null;
  const finish = (response: Response) => {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    if (origin) { headers.set("Access-Control-Allow-Origin", origin); headers.append("Vary", "Origin"); }
    return new Response(response.body, { status: response.status, headers });
  };
  try {
    const target = new URL(request.url), loopback = ["localhost", "127.0.0.1", "[::1]"];
    const suppliedOrigin = request.headers.get("origin");
    if (suppliedOrigin) {
      let parsed: URL;
      try { parsed = new URL(suppliedOrigin); } catch { return finish(new Response(null, { status: 403 })); }
      const local = loopback.includes(parsed.hostname);
      if (parsed.origin !== suppliedOrigin || parsed.username || parsed.password ||
          (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) ||
          (loopback.includes(target.hostname) && !local)) return finish(new Response(null, { status: 403 }));
      origin = suppliedOrigin;
    }
    // Credentials are never consumed by this public-only service.
    if (request.headers.has("authorization")) return finish(Response.json({ error: "This endpoint accepts public documentation requests only. Do not send credentials." }, { status: 400 }));
    if (request.method === "OPTIONS") return finish(new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, mcp-protocol-version, mcp-method, mcp-name", "Access-Control-Max-Age": "600",
    } }));
    if (request.method !== "POST") return finish(new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS" } }));
    if (!isJsonContentType(request.headers.get("content-type"))) return finish(new Response(null, { status: 415 }));
    const limited = await backend.rateLimit(request);
    if (!limited.allowed) return finish(new Response(null, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }));
    const body = await readRequestBody(request, 16_384);
    if (body.tooLarge) return finish(new Response(null, { status: 413 }));
    let message: unknown;
    try { message = JSON.parse(body.text); }
    catch { return finish(Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON." } }, { status: 400 })); }
    const factory = () => {
      const server = new Server({ name: "summer-setup", title: "Summer", version: "0.1.0" }, {
        supportedProtocolVersions: [...MCP_PROTOCOL_VERSIONS], capabilities: { tools: {} },
        instructions: "Public Summer website setup documentation. Read the relevant guide and cite its URL. These tools cannot access accounts, customer conversations, patient data or credentials, and cannot enable installations or send messages. Use only the listed topics; do not send private information.",
      });
      server.setRequestHandler("tools/list", async () => ({ tools }));
      server.setRequestHandler("tools/call", async ({ params }) => {
        const args = params.arguments ?? {};
        if (params.name === "summer_docs_list") {
          if (Object.keys(args).length) return invalid();
          return result({ guides: SETUP_DOCUMENTS.map(topic => {
            const page = backend.read(topic);
            return { topic, title: page.title, description: page.description, url: `https://gosummer.ai/docs/${topic}` };
          }) });
        }
        if (params.name !== "summer_docs_get" || Object.keys(args).length !== 1 || !SETUP_DOCUMENTS.includes(args.topic as SetupDocument)) return invalid();
        const topic = args.topic as SetupDocument, page = backend.read(topic);
        return result({ topic, title: page.title, url: `https://gosummer.ai/docs/${topic}`, markdown: page.body });
      });
      return server;
    };
    if (await isLegacyRequest(request, message)) {
      const server = factory();
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 16_384 });
      try { await server.connect(transport); return finish(await transport.handleRequest(request, { parsedBody: message })); }
      finally { await server.close(); }
    }
    const handler = createMcpHandler(factory, { legacy: "reject", maxRequestBodySize: 16_384 });
    try { return finish(await handler.fetch(request, { parsedBody: message })); }
    finally { await handler.close(); }
  } catch { return finish(Response.json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "The public setup guide is temporarily unavailable." } }, { status: 500 })); }
}
