# Summer MCP tools

Generated from the operation catalog. The hosted deployment and your granted permissions determine current availability.

| Tool | Required permission | Purpose |
| --- | --- | --- |
| `summer_account_me` | Personal account | Show the signed-in person, Summer access status and this connection's grant. |
| `summer_account_companies_list` | Personal account | List companies the person can access and whether this connection includes each one. |
| `summer_account_access_request_read` | Personal account | Read the person's Summer access request. Approval is a separate Summer team decision. |
| `summer_account_access_request_submit` | Personal account | Submit or update a Summer access request. This cannot approve access. |
| `summer_account_connections_list` | Personal account | List this person's agent connections, grants, last use and expiry. |
| `summer_account_connections_revoke` | Personal account | Revoke one of this person's agent connections immediately. |
| `summer_guides_get` | setup | Read the company's editable guidebook, draft articles, assets and publication state. Customer guides share the existing company knowledge source. |
| `summer_guides_save` | setup | Create or edit guidebook details at the expected version. Saves a private draft; does not publish. |
| `summer_guides_articles_get` | setup | Read an editable guide article and its current knowledge revision. |
| `summer_guides_articles_save` | setup | Create or edit a Markdown customer article with source references and managed asset IDs. Saves a draft in the shared knowledge library; later edits do not change a published release. |
| `summer_guides_preview` | setup | Read the exact current draft, article revisions and authenticated preview URL before publishing. No public access token is issued. |
| `summer_guides_authoring` | setup | Get the reviewed company-specific guide-building instructions for your native coding agent. It uses its own authorized writing, screenshot, image and video tools, then Summer's upload and publication APIs. No model run or customer effect starts from this read. |
| `summer_guides_publish` | guides.publish | Publish the exact selected article revisions and ready media to the company's customer help center. Requires explicit publication authority; does not approve customer business actions. |
| `summer_guides_unpublish` | guides.publish | Remove the company's guide and release media from Summer's public serving path at the expected version. Downloaded copies cannot be recalled. |
| `summer_guides_history` | setup | Read the company's guide edits, upload and publication history. |
| `summer_guides_hosting_get` | setup | Read the optional custom guide domain, DNS instructions and verified HTTPS status. Summer-hosted guide URLs need no customer DNS setup. |
| `summer_guides_hosting_save` | guides.publish | Save or remove a custom guide hostname at the expected version. Saving a name does not verify ownership or provision HTTPS. |
| `summer_guides_hosting_verify` | guides.publish | Check the saved domain's DNS ownership, attach it through Summer's hosting connection and verify HTTPS. Returns pending until each check succeeds. |
| `summer_assets_list` | setup | List the company's private guide media, metadata and upload status. Uploading does not make a file public. |
| `summer_assets_get` | setup | Read one guide asset, checksum and resumable chunk receipts. No secret upload capability is returned. |
| `summer_assets_uploads_create` | setup | Start or recover a private resumable Markdown, image, video, PDF or caption upload from metadata. Transfer file bytes with the trusted local Summer CLI; the hosted MCP server cannot read local paths. |
| `summer_assets_uploads_complete` | setup | Verify the original size, content signature and SHA-256 against saved private bytes, then mark a guide upload ready. A ready file remains private until published in a guide. |
| `summer_assets_edit` | setup | Edit guide media captions, alt text, provenance, transcript or poster at the expected version, or retire unused media. Published releases keep their pinned metadata. |
| `summer_company_capabilities` | setup | What this connection can do here, with a reason for everything unavailable. |
| `summer_company_setup_status` | setup | Saved, verified, pending, unavailable and enabled state for each setup item. |
| `summer_capability_checks_list` | capabilities.read | Read the same operational capability checklist, results, discovery paths and review history shown in Summer. Every usable API, browser or knowledge path can count. |
| `summer_capability_checks_get` | capabilities.read | Read one capability, its concrete test, evidence and latest 20 review records. |
| `summer_capability_checks_save` | setup | Edit a capability expectation or add a business-specific custom_ capability with a reason. Resets its result and retains history. Does not create a provider tool or grant execution access. |
| `summer_capability_checks_report` | setup | Record the setup agent's capability assessment with original evidence and the path Summer can discover and use. A pass needs evidence and a discovery path. Reports are labeled as agent-reported, never human approval or independently verified execution. |
| `summer_capability_checks_test` | setup | Request a read-only Summer capability test on an authorized sample case. Also needs investigations.request and current runtime access. Does not approve or execute customer changes. |
| `summer_company_settings_read` | setup | Read company-wide settings. Changes affect every environment. |
| `summer_company_settings_update` | setup | Update company-wide settings with the expected version. Affects every environment. |
| `summer_integrations_list` | setup | List provider integrations, their required fields and saved metadata. Never returns values. |
| `summer_integrations_save` | setup | Define a custom integration's credential names and labels. No secret values. Saving a definition does not establish runtime access; upload secrets through the local CLI and verify an agent-usable path. |
| `summer_credentials_list` | setup | List saved credential names, sources and versions. Never returns values. |
| `summer_credentials_set` | setup | Save one selected credential value or Doppler reference. Replacing an active credential needs credentials.replace. Returns metadata only. Secret transfer uses a local CLI handoff. |
| `summer_knowledge_list` | setup | List current company knowledge documents. Knowledge is company-wide, not per environment. |
| `summer_knowledge_create` | setup | Upload a new company knowledge document with original revision history. The shared company library is used by all roles and environments. An existing document must be read and edited instead. |
| `summer_knowledge_get` | setup | Read one company knowledge document and its current revision. |
| `summer_knowledge_history` | setup | Read the edit history of a company knowledge document. |
| `summer_knowledge_edit` | setup | Edit an existing company knowledge document with the expected revision and a reason. Affects every environment and later runs. |
| `summer_messenger_installations_list` | setup | List Messenger installations in this environment. Signing keys are never returned. |
| `summer_messenger_installations_create` | setup | Create an installation with a client-chosen ID. The one-time signing key goes to the trusted local helper, never to model-visible output. Secret transfer uses a local CLI handoff. |
| `summer_messenger_installations_update` | setup | Update installation settings with the expected version. Keeps the signing key. |
| `summer_messenger_installations_rotate_key` | setup | Issue a new signing key. Existing signed sessions end. The key goes to the trusted local helper only. Secret transfer uses a local CLI handoff. |
| `summer_messenger_assistant_read` | setup | Read assistant settings per installation and whether the managed runtime is enabled. |
| `summer_messenger_leads_list` | cases.read | Read consented website leads for this company and environment. Includes volunteered contact details and original submission references. |
| `summer_messenger_assistant_update` | setup | Update assistant instructions and escalation permission with the expected revision. Company facts live in shared knowledge. Cannot raise the spending limit. |
| `summer_messenger_voice_read` | setup | Read voice chat settings per installation, the voice services and their voices, published help article count and the voice assistant's update status. |
| `summer_messenger_voice_update` | setup | Update voice chat settings with the expected revision. Summer updates the voice assistant from these settings and the company's published help articles. |
| `summer_company_team_read` | setup | List company members and pending invitations. Role changes and invitations stay in Summer. |
| `summer_messenger_conversations_assistant` | setup | Pause the assistant in one conversation so a person can take over, or ask it to resume. Pausing stops automatic replies immediately. |
| `summer_verification_run` | setup | Run supported harmless checks. Unsupported checks are reported as unsupported, never as passed. |
| `summer_cases_list` | cases.read | List company-owned cases or conversations, newest first, with coverage and a cursor. Text search is not available through the API yet. |
| `summer_cases_get` | cases.read | Read one case or conversation with its original messages and related records. |
| `summer_cases_attachment` | cases.read | Get a short-lived download for an attachment that belongs to this case. |
| `summer_investigations_list` | cases.read | Read investigation runs, saved plans, approval state and execution receipts for a case. |
| `summer_investigations_request` | investigations.request | Ask Summer to investigate the case, or revise a saved plan with feedback. Completion is not approval. |
| `summer_actions_prepare` | actions.prepare | Prepare the exact work in the current saved plan for human approval in Summer. Does not approve or execute. |
| `summer_events_list` | setup | Read configuration and activity events after a cursor. Resume from next_cursor. |
| `summer_service_accounts_list` | automation.manage | List the company's service accounts. |
| `summer_service_accounts_save` | automation.manage | Create, update, rotate or disable a service account. A new secret goes to the trusted local helper only. Secret transfer uses a local CLI handoff. |
| `summer_webhooks_list` | automation.manage | List webhook endpoints and delivery state. |
| `summer_webhooks_save` | automation.manage | Create, update, rotate or disable a signed webhook endpoint. A new signing secret goes to the trusted local helper only. Secret transfer uses a local CLI handoff. |
| `summer_webhooks_replay` | automation.manage | Queue past events after a cursor for delivery again to one endpoint. Receivers deduplicate by event ID. |
