import { API_VERSION } from "./contract.ts";

export const MCP_VERSION = "0.2.3";
export const MINIMUM_CLI_VERSION = "0.2.0";
export const CLIENT_STATUS_META = "ai.gosummer/client-status";
const INTERVAL = 7 * 24 * 60 * 60 * 1000;
const compare = (a: string, b: string) => {
  const aa = a.split(".").map(Number), bb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i] < bb[i] ? -1 : 1;
  return 0;
};

/** Reports observed version facts; a week-old check does not prove obsolete software. */
export function clientStatus(input: { cli_version?: string; mcp_version?: string; last_checked_at?: string } = {}, now = Date.now()) {
  const warnings: { code: string; message: string }[] = [];
  if (input.cli_version && compare(input.cli_version, MINIMUM_CLI_VERSION) < 0)
    warnings.push({ code: "cli_outdated", message: `Summer CLI ${input.cli_version} predates this catalog. Run npm install -g @gosummerai/cli@latest, then summer version --check --json. A source checkout is not a published release.` });
  if (input.mcp_version && compare(input.mcp_version, MCP_VERSION) !== 0)
    warnings.push({ code: "mcp_catalog_changed", message: `Your cached Summer MCP version ${input.mcp_version} differs from live ${MCP_VERSION}. Refresh initialization and tools/list using your saved OAuth connection. A version change needs no new login or permission.` });
  const checked = input.last_checked_at ? Date.parse(input.last_checked_at) : NaN;
  const refreshRequired = !Number.isFinite(checked) || checked > now || now - checked >= INTERVAL;
  if (refreshRequired) warnings.push({ code: "freshness_check_due", message: "The last successful client check is unknown or at least seven days old. Check the published CLI version and refresh MCP initialization and tools/list; age alone does not prove an old version." });
  return { api_version: API_VERSION, mcp_version: MCP_VERSION, minimum_cli_version: MINIMUM_CLI_VERSION, checked_at: new Date(now).toISOString(), check_interval_days: 7,
    reported: input, refresh_required: refreshRequired, warnings };
}

/** Optional diagnostics never invalidate or authorize the business request. */
export function requestClientStatus(request: Request, params: Record<string, unknown> = {}) {
  const meta = params._meta as Record<string, unknown> | undefined;
  const report = meta?.["ai.gosummer/client"] as Record<string, unknown> | undefined;
  const info = (meta?.["io.modelcontextprotocol/clientInfo"] ?? params.clientInfo) as { name?: unknown; version?: unknown } | undefined;
  const agentVersion = /^summer-cli\/(\d+\.\d+\.\d+)(?:\s|$)/.exec(request.headers.get("user-agent") ?? "")?.[1];
  const cliVersion = report?.cli_version ?? request.headers.get("summer-cli-version") ?? agentVersion
    ?? (info && ["summer-cli", "@gosummerai/cli"].includes(String(info.name)) ? info.version : undefined);
  const mcpVersion = report?.mcp_version ?? request.headers.get("summer-mcp-version");
  const checkedAt = report?.last_checked_at ?? request.headers.get("summer-last-checked-at");
  const version = (value: unknown): value is string => typeof value === "string" && value.length <= 40 && /^\d+\.\d+\.\d+$/.test(value);
  const validTime = typeof checkedAt === "string" && checkedAt.length <= 40 && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(checkedAt) && Number.isFinite(Date.parse(checkedAt));
  return clientStatus({ ...(version(cliVersion) ? { cli_version: cliVersion } : {}), ...(version(mcpVersion) ? { mcp_version: mcpVersion } : {}), ...(validTime ? { last_checked_at: checkedAt } : {}) });
}
