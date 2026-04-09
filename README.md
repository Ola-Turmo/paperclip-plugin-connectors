# @uos/plugin-connectors

@uos/plugin-connectors owns connector policy, callback routing, auth flows, provider capability bindings, and the runtime surface that lets UOS speak to external systems. It exists so provider complexity is isolated, measurable, and governed instead of leaking across the platform.

Built as part of the UOS split workspace on top of [Paperclip](https://github.com/paperclipai/paperclip), which remains the upstream control-plane substrate.

## What This Repo Owns

- Provider auth and token lifecycle management.
- Callback routing, webhook handling, retries, and reconciliation.
- Capability declaration, policy enforcement, and runtime bindings.
- Connector health telemetry, error classification, and certification.
- Compatibility management for upstream provider API changes.

## Runtime Form

- Split repo with package code as the source of truth and a Paperclip plugin scaffold available for worker, manifest, UI, and validation surfaces when the repo needs runtime or operator-facing behavior.

## Highest-Value Workflows

- Adding a new provider with explicit capability descriptors.
- Diagnosing auth failures, callback mismatches, and drift after upstream changes.
- Rolling connector versions forward safely with certification coverage.
- Reconciling provider-side state with UOS expectations.
- Hardening policy around scopes, retries, rate limits, and tenancy boundaries.

## Key Connections and Operating Surfaces

- OAuth/OIDC providers, webhook gateways, API proxies, secret managers, callback endpoints, browser login flows, and provider admin consoles needed to establish or debug external connectivity.
- Google Workspace, Slack, Discord, Teams, GitHub, Notion, Linear, Jira, HubSpot, Salesforce, Zendesk, Intercom, Stripe, X, LinkedIn, YouTube, TikTok, and analytics/data platforms whenever the connector layer must expose those systems to the wider UOS stack.
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
