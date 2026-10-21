# Architecture

The package serves MCP using the official SDK. The host supplies an explicit `McpConfig` and `McpBackend` to `handleMcp(request, config, backend)`.

```text
AI client -> MCP transport -> host authentication and executor -> company systems
                  |
          shared operation catalog
```

The same operation catalog can generate the host's API and documentation. Keep it as one source rather than maintaining separate MCP and API schemas.

## Host responsibilities

The backend must validate the token audience, expiry and revocation, current company access and environment grants. `admit` runs for each authenticated request and again for tool calls with a selected company. A supplied invalid token must fail even for a discovery request.

The executor must enforce the operation's scope, current membership, role, ownership, expected revision and required human approval. It must preserve idempotency and uncertain outcomes. The transport's tool filtering and annotations are not authorization.

Rate limiting uses the host's trusted client address and connection identifier. Never trust arbitrary forwarding headers without configuring your trusted proxy boundary. The package calls the supplied limiter; the host owns its persistence and failure policy.

Only static schemas and metadata are available without a token. Prompt rendering and private resource reads cannot use anonymous discovery. The setup prompt callback runs only after admission.

Configuration contains public origins and installation instructions. Storage credentials, token lookup, encryption keys, company policies and business handlers belong in the host.

## Secret transfer

Operations that would move or issue a secret return a CLI handoff. The host still authorizes the requested operation before that handoff. The local CLI has its own authenticated connection and sends the value directly to its destination. Do not add a secret value to a tool schema or handoff response.

## Testing

The independent tests use synthetic data and an in-process official SDK client. They check protocol generations, discovery without company reads, token refusal, protected calls, secret handoffs, scope challenges, origins, host checks and body limits.

Summer also runs application integration and end-to-end tests before deployment. Standalone tests establish the transport contract, not successful execution against a production company.
