# Summer MCP tools

Generated from the operation catalog. The hosted deployment and your granted permissions determine current availability.

| Tool | Required permission | Purpose |
| --- | --- | --- |
| `summer_github_connection_read` | setup | Read the company GitHub installation, selected repositories/folders and cached commit status. Makes no GitHub request and returns no credentials. |
| `summer_github_connection_start` | setup | Get the Summer browser URL for a company administrator to install and authorize the read-only GitHub App. Does not grant access or connect an installation by itself. |
| `summer_github_repositories_list` | setup | List repositories available to this company GitHub installation. Provider metadata read; no file content. |
| `summer_github_folders_list` | setup | Browse repository folders at a branch or commit before selecting access. |
| `summer_github_sources_save` | setup | Choose repository branches/commits and allowed folders. A dot selects the whole repository. Replaces selections with an expected version and invalidates old cached access. Does not sync code. |
| `summer_github_sources_sync` | setup | Refresh the selected repository code cache once from GitHub. Reuses the cache for an unchanged commit; sandbox startup never pulls GitHub. |
| `summer_github_sources_read` | setup | List cached source paths, or read one cached file with path. Only currently selected company folders are available. No live GitHub call or credentials. |
| `summer_github_connection_disconnect` | setup | Disconnect this company/environment GitHub source access and remove its cached archives. |
| `summer_support_policy_read` | cases.read | Read business hours, holidays, response commitments and scheduled policy revisions. |
| `summer_support_policy_update` | setup | Save business hours and response commitments with the expected revision and an effective date. |
| `summer_saved_replies_list` | cases.read | Read company saved replies, optionally including retired replies. |
| `summer_saved_replies_save` | setup | Create, edit, retire or restore a saved reply with its expected revision and reason. Sends nothing. API reference: https://api.gosummer.ai/v1/openapi.json |
| `summer_saved_replies_history` | cases.read | Read original revisions of a saved reply. |
| `summer_saved_views_list` | cases.read | Read this person's saved inbox views and shared company views. |
| `summer_saved_views_save` | workspace.write | Save a personal or shared inbox view. Known case filters are normalized by the same service as the UI. |
| `summer_saved_views_delete` | workspace.write | Remove an owned inbox view, retaining the database's ownership checks. |
| `summer_quality_scenarios_list` | cases.read | Read quality scenarios, assessments and current outcomes. |
| `summer_quality_scenarios_get` | cases.read | Read one scenario and its saved assessments. |
| `summer_quality_scenarios_save` | setup | Create, revise or retire a quality scenario, with expected revision and reason. |
| `summer_quality_assessments_save` | workspace.write | Record an evidence-backed assessment or correction. Does not approve a plan or customer action. |
| `summer_quality_corrections_list` | cases.read | Read evidence-backed corrections to previous quality assessments. |
| `summer_privacy_requests_list` | setup | Read privacy export/deletion requests, status and original event history. Does not export or delete data. |
| `summer_privacy_requests_create` | setup | File an export or deletion request for human review. Cannot approve, perform or attest completion of the work. |
| `summer_work_routing_read` | setup | Read eligible teammates and automatic owner/reviewer routing settings. |
| `summer_work_routing_update` | setup | Save automatic owner/reviewer routing with the expected version. Does not grant roles or approval authority. |
| `summer_cases_assignment_read` | cases.read | Read a case's issue owner, plan reviewer and eligible teammates. |
| `summer_cases_assignment_update` | workspace.write | Assign an issue owner or plan reviewer with the previous owner as a conflict check. Does not grant roles or approve a plan. |
| `summer_reports_credits` | cases.read | Read all-time and month-to-date credits, pending reservations and monthly usage in the company timezone. |
| `summer_reports_service_metrics` | cases.read | Read current response and resolution metrics in the company timezone. |
| `summer_reports_delivery` | cases.read | Read delivery attempts, failures and recorded results. Does not retry a delivery. |
| `summer_reports_commitments` | cases.read | Read outstanding customer promises and unfinished work. |
| `summer_agent_exclusions_list` | cases.read | Read the company's sender exclusions and original edit history. Changes retain human approval. |
| `summer_messenger_conversations_list` | cases.read | Search and filter the complete Messenger inbox, including visitor conversations without Ops cases. |
| `summer_messenger_conversations_get` | cases.read | Read original Messenger messages with saved human sender_display_name, contact form details, read receipts and attachments without marking the chat read. |
| `summer_pharmacy_calls_settings_read` | cases.read | Read demo pharmacy-call voice, vocabulary and change history. Starts no call. |
| `summer_pharmacy_calls_settings_update` | setup | Save the demo pharmacy-call voice and vocabulary with the expected revision. Starts no call. |
| `summer_imports_intercom_list` | setup | Read Intercom migration previews, saved progress, counts, errors and Summer inbox destinations. Does not start an import. |
| `summer_imports_intercom_preview` | setup | Check the saved Intercom key against a workspace and preview contact/conversation counts. Save the selected Summer inbox and explicit account-matching choice. Import nothing; send nothing. |
| `summer_imports_intercom_control` | setup | Start, pause, resume or rescan an Intercom migration with its current version. Optional incremental sync reconciles the same original IDs; no replies, notifications or agent runs. Names/email never verify an account. |
| `summer_imports_intercom_profiles` | cases.read | Search imported Summer profiles and their original conversation references. Contact details do not establish account ownership. |
| `summer_client_status` | Personal account | Check live Summer MCP/API versions, old client warnings and the seven-day discovery refresh interval. Optional cached client versions and the last successful check timestamp distinguish known and unknown status. |
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
| `summer_guides_authoring` | setup | Read the company's reviewed guide-authoring brief, draft article references and publication state. This read starts no model run and changes no customer data. |
| `summer_guides_publish` | guides.publish | Publish the exact selected article revisions and ready media to the company's customer help center. Requires explicit publication authority; does not approve customer business actions. |
| `summer_guides_unpublish` | guides.publish | Remove the company's guide and release media from Summer's public serving path at the expected version. Downloaded copies cannot be recalled. |
| `summer_guides_history` | setup | Read the company's guide edits, upload and publication history. |
| `summer_guides_hosting_get` | setup | Read the optional custom guide domain, DNS instructions and verified HTTPS status. Summer-hosted guide URLs need no customer DNS setup. |
| `summer_guides_hosting_save` | guides.publish | Save or remove a custom guide hostname at the expected version. Saving a name does not verify ownership or provision HTTPS. |
| `summer_guides_hosting_verify` | guides.publish | Check the saved domain's DNS ownership, attach it through Summer's hosting connection and verify HTTPS. Returns pending until each check succeeds. |
| `summer_assets_list` | setup | List the company's private guide media, metadata and upload status. Uploading does not make a file public. |
| `summer_assets_get` | setup | Read one guide asset, checksum and resumable chunk receipts. No secret upload capability is returned. |
| `summer_assets_uploads_create` | setup | Start or recover a private resumable Markdown, image, video, PDF or caption upload from metadata. File bytes are transferred separately; this hosted endpoint has no local filesystem access. |
| `summer_assets_uploads_complete` | setup | Verify the original size, content signature and SHA-256 against saved private bytes, then mark a guide upload ready. A ready file remains private until published in a guide. |
| `summer_assets_edit` | setup | Edit guide media captions, alt text, provenance, transcript or poster at the expected version, or retire unused media. Published releases keep their pinned metadata. |
| `summer_company_capabilities` | setup | What this connection can do here, with a reason for everything unavailable. |
| `summer_company_setup_status` | setup | Saved, verified, pending, unavailable and enabled state for each setup item. |
| `summer_capability_checks_list` | capabilities.read | Read the same operational capability checklist, results, discovery paths and review history shown in Summer. Every usable API, browser or knowledge path can count. |
| `summer_capability_checks_get` | capabilities.read | Read one capability, its concrete test, evidence and latest 20 review records. |
| `summer_capability_checks_save` | setup | Edit a capability expectation or add a business-specific custom_ capability with a reason. Resets its result and retains history. Does not create a provider tool or grant execution access. |
| `summer_capability_checks_report` | setup | Record the setup agent's capability assessment with original evidence and the path Summer can discover and use. A pass needs evidence and a discovery path. Reports are labeled as agent-reported, never human approval or independently verified execution. |
| `summer_capability_checks_test` | setup | Request a read-only Summer capability test on an authorized sample case. Also needs investigations.request and current runtime access. Does not approve or execute customer changes. |
| `summer_company_settings_read` | setup | Read company-wide settings, including the email subject customers see on new support emails. Changes affect every environment. |
| `summer_company_settings_update` | setup | Update company-wide settings with the expected version. Affects every environment. |
| `summer_integrations_list` | setup | List provider integrations, their categories, required fields and saved metadata. Filter by search, category or connection. Connected means all required credentials are available, not a live provider check. Never returns values. |
| `summer_integrations_save` | setup | Save a custom integration's description, setup instructions and credential field names. This saves metadata only, without credential values or a live connection check. |
| `summer_integrations_setup_prompt` | setup | Prepare an integration-specific MCP setup prompt and Codex or Claude Code app links. Includes the selected company, environment and setup brief, never credential values. Does not launch an app or change configuration. |
| `summer_credentials_list` | setup | List saved credential names, sources and versions. Never returns values. |
| `summer_credentials_set` | setup | Save one selected credential value or Doppler reference. Replacing an active credential needs credentials.replace. Returns metadata only. Secret transfer uses a local CLI handoff. |
| `summer_knowledge_list` | setup | List current company knowledge documents. Knowledge is company-wide, not per environment. |
| `summer_knowledge_create` | setup | Upload a new company knowledge document with original revision history. The shared library is used by all roles and environments. Existing document IDs are refused. API reference: https://api.gosummer.ai/v1/openapi.json |
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
| `summer_messenger_email_read` | setup | Read support email addresses: the private forwarding address, the one DNS record to add, whether mail has arrived, sending status, Gmail forwarding codes and emails that need a look. |
| `summer_messenger_email_create` | setup | Add a support email address. Summer creates its private forwarding address and signing key and returns the DNS record to add. The address starts off; nothing is sent. |
| `summer_messenger_email_update` | setup | Change the sender name or turn a support email address on or off, with the expected version. Turning on needs one received email. Turning off keeps every email but stops new conversations and replies. |
| `summer_messenger_email_check` | setup | Check forwarding, the DNS record and sending status for one support email address now. Records the latest sending status; sends nothing. |
| `summer_slack_identity_read` | setup | Read the support name and avatar shown on Summer's approved Slack replies, whether the Slack install allows them, and the change history. |
| `summer_slack_identity_update` | setup | Set the support name and avatar on Summer's approved Slack replies, with the expected revision and a reason. Null values use the plain Summer Ellis identity. Sends no message. |
| `summer_company_team_read` | setup | List company members and pending invitations. Role changes and invitations stay in Summer. |
| `summer_messenger_conversations_assistant` | setup | Pause the assistant in one conversation so a person can take over, or ask it to resume. Pausing stops automatic replies immediately. |
| `summer_verification_run` | setup | Run supported harmless checks. Unsupported checks are reported as unsupported, never as passed. |
| `summer_cases_list` | cases.read | List company-owned cases or conversations with emotion filters (sentiment: happy, neutral, upset, angry, sad, mixed or unknown), ordering, page size, coverage and a cursor. Operational rows include conversationSentiment (label, confidence, evidence references, source, assessed_at and pending freshness). Operational filters require the company's operational connection; Messenger-only results include coverage limits. |
| `summer_cases_search` | cases.read | Find cases by customer name, email, phone, date of birth, support code, order or tracking number, vendor or Stripe ID, or message words, with status and date filters. Returns one current workspace per verified customer (explicit splits stay separate), with the actual ticket code, all issue references, plan and run progress, orders and message excerpts. Message case_id opens the workspace; source_case_id retains the original issue. Search matches are leads, not proof of identity or completed work. |
| `summer_cases_get` | cases.read | Read one case or conversation with its original messages and related records. Operational records include workspace with the current customer ticket and all owned issue references, plus the shared saved timeline. The original case identity is retained. Includes conversationSentiment with happy, neutral, upset, angry, sad, mixed or unknown, confidence, exact evidence references, source, assessed_at and pending freshness; an estimate does not prove resolution. |
| `summer_cases_attachment` | cases.read | Get a short-lived download for an attachment that belongs to this case. |
| `summer_cases_customer_profile` | cases.read | Read the case customer's profile: name, date of birth, contact details, default shipping and billing addresses, each order's addresses and earlier addresses. A saved address does not prove where an existing order ships. |
| `summer_investigations_list` | cases.read | Read shared investigation runs, saved plans, approval state and execution receipts across the verified customer’s cases, including historical issues. Each run retains its original support_case_id; use that ID for write operations and original run evidence. |
| `summer_runs_list` | cases.read | List investigation and execution runs across cases, newest first, with status, plan approval and date filters. |
| `summer_investigations_request` | investigations.request | Ask Summer to investigate the case, or revise a saved plan with feedback. Completion is not approval. |
| `summer_actions_prepare` | actions.prepare | Prepare the exact current plan and return its execution ID, approval hash and reviewed work. Does not approve or execute. A delegated actions.approve grant can approve authorized work through API, CLI or MCP. |
| `summer_actions_approve` | actions.approve | Approve the exact prepared execution under the authenticated operator's delegated authority. Use only for work the operator authorized, read the prepared review first, and pass its exact hash. Records the authorization and queues ordinary execution; approval does not prove a customer outcome. No caller-supplied approver identity or identity-verification attestation. |
| `summer_events_list` | setup | Read configuration and activity events after a cursor. Pagination uses next_cursor. |
| `summer_service_accounts_list` | automation.manage | List the company's service accounts. |
| `summer_service_accounts_save` | automation.manage | Create, update, rotate or disable a service account. A new secret goes to the trusted local helper only. Secret transfer uses a local CLI handoff. |
| `summer_webhooks_list` | automation.manage | List webhook endpoints and delivery state. |
| `summer_webhooks_save` | automation.manage | Create, update, rotate or disable a signed webhook endpoint. A new signing secret goes to the trusted local helper only. Secret transfer uses a local CLI handoff. |
| `summer_webhooks_replay` | automation.manage | Queue past events after a cursor for delivery again to one endpoint. Receivers deduplicate by event ID. |
