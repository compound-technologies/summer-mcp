# Summer MCP for Claude, Codex and Cursor

Investigate stuck orders and billing issues, read customer conversations and connect the tools behind your telehealth support operation from your AI assistant.

[Summer](https://gosummer.ai) brings the conversation, investigation evidence and proposed next step into one support workspace. Its hosted MCP server lets your agent work with the same company records and setup.

- **Hosted endpoint:** `https://api.gosummer.ai/mcp`
- **Transport:** Streamable HTTP
- **Sign-in:** Summer OAuth, with companies, environments and permissions you choose

[Connect your client](https://gosummer.ai/docs/mcp-clients) · [Explore integrations](https://gosummer.ai/docs/service-connections) · [Book a demo](https://gosummer.ai/book)

## Connect

You can use hosted Summer without cloning this repository or running a server.

### Claude Code

```sh
claude mcp add --transport http summer https://api.gosummer.ai/mcp
```

Run `/mcp`, choose Summer and authenticate in your browser.

### Codex

```sh
codex mcp add summer --url https://api.gosummer.ai/mcp
codex mcp login summer
```

### Cursor

Add this to your MCP configuration, then connect in Cursor's MCP settings:

```json
{
  "mcpServers": {
    "summer": { "url": "https://api.gosummer.ai/mcp" }
  }
}
```

Other clients need remote MCP over Streamable HTTP and OAuth. See the [client guide](https://gosummer.ai/docs/mcp-clients) for permissions and your first task.

## What can I do?

| Job | How Summer helps |
| --- | --- |
| Find out why an order is stuck | Read the case, request an investigation and review the evidence behind the delay. |
| Understand a billing complaint | Review the customer's conversation and the purchase or subscription evidence gathered through the company's connected systems. |
| Get a plan ready for a decision | Read the proposed changes and prepare the saved actions for a person to approve in Summer. |
| Connect a support tool | Check the company's configuration and guide credential entry through Summer or a trusted local CLI handoff. |
| Keep support policies current | Read and revise company knowledge with a reason and revision history. |
| Add support to your website | Use a coding agent and the Summer CLI to install Messenger in your project. |
| Let a teammate take over | Pause automatic replies in one conversation, then resume them when the teammate is done. |

Case work requires the relevant permissions and an enabled operational connection. A prepared plan does not execute customer or business changes. A person approves those changes in Summer. Clinical questions belong with the care team.

## Connect the tools you already use

Built-in credential setups include Intercom, Stripe, EasyPost, MD Integrations, Beluga Health, GEN Health, Quo and Supabase. Slack has its own authorization flow. Other help desks, clinical platforms and pharmacies use custom API connections or supported browser workflows.

Each workflow needs the right access and a successful check. Your AI client connects to Summer; Summer's investigator gathers case evidence through the company's configured services.

[Browse connection guides](https://gosummer.ai/docs/service-connections).

## Prompts to try

> Check my Summer connection. Show which companies I can access, then explain what is ready for the company I choose. Do not change anything.

> Read case CASE_ID. What did the customer ask for, what has already been done and what remains unresolved?

> Ask Summer to investigate the delayed order in case CASE_ID. Explain the evidence behind the delay and the next useful step.

> Review the latest saved plan for case CASE_ID and prepare its exact changes for approval in Summer.

> Help me connect Intercom and Stripe to Summer. Check the existing setup and explain what still needs verification.

Replace CASE_ID with a case your connection can access. To install Summer in a website project, start with the [agent setup guide](https://gosummer.ai/docs/agent-setup).

## What is in this repository?

This is the source for Summer's MCP transport and shared operation contract. The Summer application uses this package with its own backend adapter.

- The official MCP SDK handles the protocol, discovery and result encoding.
- The operation catalog defines tool names, schemas, permission requirements and descriptions. [Browse the tool reference](docs/tools.md).
- The host supplies live authentication, permission enforcement, rate limits and operation execution through [`McpBackend`](src/backend.ts).
- Secret-moving operations return local CLI handoffs. Secret values are not MCP arguments or results.
- Static discovery is public. Tool calls, private resources and rendered setup prompts require authentication. Invalid supplied tokens cannot fall back to anonymous discovery.

The hosted service includes private storage and operational services that are not distributed here. The synthetic example below exercises the transport; it does not run a complete Summer support workspace. Features in source can precede a hosted release. Check your company's capabilities for current availability.

## Build and test the source

Requires Node.js 22.18 or newer.

```sh
npm ci --ignore-scripts
npm run check
npm run demo
```

The demo listens only on `127.0.0.1:3434`. It uses synthetic records and the literal test header `Authorization: Bearer demo-only`. It has no production credentials and cannot access Summer. It implements a few reads and refuses unsupported operations. The real hosted service uses Summer OAuth.

[`examples/demo-backend`](examples/demo-backend) shows how a host supplies the backend. Your integration must enforce current permissions and ownership in its executor; this interface does not replace those checks. See [architecture and host responsibilities](docs/architecture.md).

This repository publishes source on GitHub. It does not currently publish `@gosummerai/mcp` to npm. The separate [Summer CLI](https://www.npmjs.com/package/@gosummerai/cli) handles local setup and secret transfer.

## Maintenance and contributions

Summer maintains this package in its private development repository and exports reviewed files here after passing release checks. This repository has clean public history; it does not include private application history.

Issues and pull requests are welcome. Accepted changes are integrated into the source repository, tested with Summer and then exported here. See [CONTRIBUTING.md](CONTRIBUTING.md). The code is available under the [MIT license](LICENSE).
