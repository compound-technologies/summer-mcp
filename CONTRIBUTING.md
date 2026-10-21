# Contributing

Open an issue for a reproducible bug or a proposal, or submit a focused pull request with tests. Please use synthetic examples. Do not include access tokens, customer conversations, company records, private policies or production logs.

Run `npm ci --ignore-scripts` and `npm run check` before submitting a change.

This repository is a one-way public export of Summer's maintained source. Maintainers incorporate accepted contributions in the source repository, run standalone and application checks, then export the result. A public pull request may be closed with a link to the exported fix rather than merged directly.

Protocol changes should follow the current official MCP specification and SDK. Preserve public static discovery, authenticated tool calls, explicit OAuth challenges, conservative tool hints and secret-free CLI handoffs.

Report a potential credential or private-data exposure through [Summer support](https://gosummer.ai/docs/troubleshooting). Do not put the sensitive material in a public issue.
