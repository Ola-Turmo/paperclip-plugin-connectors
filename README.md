# @uos/plugin-connectors

@uos/plugin-connectors is the provider-control plane for UOS. It owns auth flows, token lifecycle, callback routing, webhook handling, capability descriptors, and connector policy so provider complexity stays isolated instead of leaking into setup, operations, or tool plugins.

Built as part of the UOS split workspace on top of [Paperclip](https://github.com/paperclipai/paperclip), which remains the upstream control-plane substrate.

## Boundary Summary

- Owns provider auth, callback routing, webhook control, connector policy, and integration certification.
- Depends on [uos-core](https://github.com/Ola-Turmo/uos-core) for shared contracts and compatibility rules.
- Feeds install-time connector requirements into [uos-plugin-setup-studio](https://github.com/Ola-Turmo/uos-plugin-setup-studio).
- Feeds health and exception signals into [uos-plugin-operations-cockpit](https://github.com/Ola-Turmo/uos-plugin-operations-cockpit) and stays narrower than the tool plugins.

## What This Repo Owns

- Provider auth and token lifecycle management.
- Callback routing, webhook handling, retries, and reconciliation.
- Capability declaration, policy enforcement, and runtime bindings.
- Connector health telemetry, error classification, and certification.
- Compatibility management for upstream provider API changes.

## Runtime Form

- Plugin-first provider layer that exposes governed external-system access to the rest of UOS without swallowing app-specific tool logic.

## Highest-Value Workflows

- Add a new provider with explicit capability descriptors and clear write boundaries.
- Diagnose auth failures, callback mismatches, or drift after upstream provider changes.
- Roll connector versions forward safely with certification coverage.
- Reconcile provider-side state with UOS expectations at the integration boundary.
- Harden policy around scopes, retries, rate limits, tenancy boundaries, and fallback paths.

## Key Connections and Operating Surfaces

- OAuth/OIDC providers, webhook gateways, API proxies, secret managers, callback endpoints, browser login flows, and provider admin consoles needed to establish or debug external connectivity.
- Google Workspace, Slack, Discord, Teams, GitHub, Notion, Linear, Jira, HubSpot, Salesforce, Zendesk, Intercom, Stripe, X, LinkedIn, YouTube, TikTok, and analytics platforms whenever the connector layer must expose those systems to the wider UOS stack.
- Provider SDKs, REST/GraphQL specs, rate-limit guidance, audit logs, status pages, and error telemetry to keep integrations trustworthy under real-world load.
- CSV import/export, browser-native admin workflows, and fallback operator queues when direct APIs are partial, under-scoped, or operationally weaker than a documented workaround.

## KPI Targets

- Auth setup success reaches >= 90% for maintained provider families on the first guided attempt.
- Webhook and callback processing success stays >= 99% for certified connectors under benchmark load.
- A new provider MVP can move from capability descriptor to certified beta in <= 3 engineering days.
- Known connector incident MTTR stays <= 2 hours for previously classified auth, webhook, or rate-limit failures.

## Implementation Backlog

### Now
- Create a canonical provider capability registry covering auth model, event model, scopes, and write boundaries.
- Harden the first wave of high-value provider families around callbacks, retries, and error telemetry.
- Add certification criteria that block connector promotion when fallback paths or audit coverage are missing.

### Next
- Automate release-watch and schema-drift detection for volatile upstream providers.
- Standardize browser-assisted recovery flows for providers with weak or misleading APIs.
- Expose connector health and exception signals more directly into the operations cockpit.

### Later
- Generate more of the connector scaffolding from provider capability descriptors.
- Build policy-aware multi-provider orchestration patterns on top of the certified connector base.

## Local Plugin Use

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"<absolute-path-to-this-repo>","isLocalPath":true}'
```

## Validation

```bash
npm install
npm test
npm run plugin:typecheck
npm run plugin:test
```
