---
repo: "uos-plugin-connectors"
display_name: "@uos/plugin-connectors"
package_name: "@uos/plugin-connectors"
lane: "plugin"
artifact_class: "TypeScript package / integration layer"
maturity: "earlier in extraction than core"
generated_on: "2026-04-03"
assumptions: "Grounded in the current split-repo contents, package metadata, README/PRD alignment pass, and the Paperclip plugin scaffold presence where applicable; deeper module-level inspection should refine implementation detail as the code evolves."
autonomy_mode: "maximum-capability autonomous work with deep research and explicit learning loops"
---

# PRD: @uos/plugin-connectors

## 1. Product Intent

**Package / repo:** `@uos/plugin-connectors`  
**Lane:** plugin  
**Artifact class:** TypeScript package / integration layer  
**Current maturity:** earlier in extraction than core  
**Source-of-truth assumption:** Extracted integration surface with ongoing transition pressure from the broader UOS authoring path.
**Runtime form:** Split repo with package code as the source of truth and a Paperclip plugin scaffold available for worker, manifest, UI, and validation surfaces when the repo needs runtime or operator-facing behavior.

@uos/plugin-connectors owns connector policy, callback routing, auth flows, provider capability bindings, and the runtime surface that lets UOS speak to external systems. It exists so provider complexity is isolated, measurable, and governed instead of leaking across the platform.

## 2. Problem Statement

External providers change constantly: auth models drift, rate limits surprise, webhook semantics differ, and SDKs deprecate without warning. Connector sprawl becomes a platform tax unless capability declarations, policy, and testing are first-class.

## 3. Target Users and Jobs to Be Done

- Platform teams extending UOS to new providers.
- Department overlays that depend on stable external data/action flows.
- Operators diagnosing auth and callback failures.
- Security/compliance reviewers overseeing scopes and data movement.

## 4. Outcome Thesis

**North star:** Connector work becomes boring in the best way: fast to add, easy to certify, observable in production, and resilient to upstream change.

### 12-month KPI targets
- Auth setup success reaches >= 90% for maintained provider families on the first guided attempt.
- Webhook and callback processing success stays >= 99% for certified connectors under benchmark load.
- A new provider MVP can move from capability descriptor to certified beta in <= 3 engineering days.
- Known connector incident MTTR stays <= 2 hours for previously classified auth, webhook, or rate-limit failures.
- 100% of supported providers have a scope matrix, capability descriptor, and operator-visible fallback path.

### Acceptance thresholds for the next implementation wave
- Each supported provider has explicit auth, scope, callback, retry, and tenancy rules checked into the repo.
- Contract tests and smoke flows exist for every certified connector family.
- No connector can be marked ready without audit logging and error classification coverage.
- Browser-admin fallback steps exist whenever the direct API path is known to be incomplete or operationally weak.

## 5. In Scope

- Provider auth and token lifecycle management.
- Callback routing, webhook handling, retries, and reconciliation.
- Capability declaration, policy enforcement, and runtime bindings.
- Connector health telemetry, error classification, and certification.
- Compatibility management for upstream provider API changes.

## 6. Explicit Non-Goals

- Owning generic orchestration behavior that belongs in core.
- Owning domain-specific department workflows above connector primitives.
- Hard-coding provider assumptions into unrelated packages.

## 7. Maximum Tool and Connection Surface

- This repo should assume it may use any connection, API, browser flow, CLI, document surface, dataset, or storage system materially relevant to completing the job, as long as the access pattern is lawful, auditable, and proportionate to risk.
- Do not artificially limit execution to the tools already named in the repo if adjacent systems are clearly required to close the loop.
- Prefer first-party APIs and direct integrations when available, but use browser automation, provider CLIs, structured import/export, and human-review queues when they are the most reliable path to completion.
- Treat communication systems, docs, spreadsheets, issue trackers, code hosts, cloud consoles, dashboards, databases, and admin panels as valid operating surfaces whenever the repo's job depends on them.
- Escalate only when the action is irreversible, privacy-sensitive, financially material, or likely to create external side effects without adequate review.

### Priority surfaces for connector work
- OAuth/OIDC providers, webhook gateways, API proxies, secret managers, callback endpoints, browser login flows, and provider admin consoles needed to establish or debug external connectivity.
- Google Workspace, Slack, Discord, Teams, GitHub, Notion, Linear, Jira, HubSpot, Salesforce, Zendesk, Intercom, Stripe, X, LinkedIn, YouTube, TikTok, and analytics/data platforms whenever the connector layer must expose those systems to the wider UOS stack.
- Provider SDKs, REST/GraphQL specs, rate-limit guidance, audit logs, status pages, and error telemetry to keep integrations trustworthy under real-world load.
- CSV import/export, browser-native admin workflows, and fallback operator queues when direct APIs are partial, under-scoped, or operationally weaker than a documented workaround.

### Selection rules
- Start by identifying the systems that would let the repo complete the real job end to end, not just produce an intermediate artifact.
- Use the narrowest safe action for high-risk domains, but not the narrowest tool surface by default.
- When one system lacks the evidence or authority needed to finish the task, step sideways into the adjacent system that does have it.
- Prefer a complete, reviewable workflow over a locally elegant but operationally incomplete one.

## 8. Autonomous Operating Model

This PRD assumes **maximum-capability autonomous work**. The repo should not merely accept tasks; it should research deeply, compare options, reduce uncertainty, ship safely, and learn from every outcome. Autonomy here means higher standards for evidence, reversibility, observability, and knowledge capture—not just faster execution.

### Required research before every material task
1. Read the repo README, this PRD, touched source modules, existing tests, and recent change history before proposing a solution.
1. Trace impact across adjacent UOS repos and shared contracts before changing interfaces, schemas, or runtime behavior.
1. Prefer evidence over assumption: inspect current code paths, add repro cases, and study real failure modes before implementing a fix.
1. Use external official documentation and standards for any upstream dependency, provider API, framework, CLI, or format touched by the task.
1. For non-trivial work, compare at least two approaches and explicitly choose based on reversibility, operational safety, and long-term maintainability.

### Repo-specific decision rules
- Use explicit capability declarations rather than hidden provider branches.
- Prefer adapter layers and policy tables over copy-pasted one-off logic.
- Certification and observability are part of the feature, not post-work.
- Security and data-boundary clarity beat convenience in auth design.

### Mandatory escalation triggers
- New privileged scopes, data residency implications, or sensitive data flows.
- Provider changes that silently weaken guarantees or break tenant isolation.
- Connector behavior that requires exceptions to shared policy.
- Any destructive or irreversible external action without strong guardrails.

## 9. Continuous Learning Requirements

### Required learning loop after every task
- Every completed task must leave behind at least one durable improvement: a test, benchmark, runbook, migration note, ADR, or automation asset.
- Capture the problem, evidence, decision, outcome, and follow-up questions in repo-local learning memory so the next task starts smarter.
- Promote repeated fixes into reusable abstractions, templates, linters, validators, or code generation rather than solving the same class of issue twice.
- Track confidence and unknowns; unresolved ambiguity becomes a research backlog item, not a silent assumption.
- Prefer instrumented feedback loops: telemetry, evaluation harnesses, fixtures, or replayable traces should be added whenever feasible.

### Repo-specific research agenda
- Which provider capabilities should be formalized into a universal registry?
- What auth and callback failure modes recur most often across connectors?
- Where can simulators, fakes, or contract tests replace fragile live-only validation?
- Which providers are most volatile and need release-watch automation?
- How can connector certification become faster while remaining trustworthy?

### Repo-specific memory objects that must stay current
- Provider capability matrix.
- Auth and callback incident fingerprints.
- Connector certification catalog.
- Provider release watchlist and upgrade notes.
- Policy exception log.

## 10. Core Workflows the Repo Must Master

1. Adding a new provider with explicit capability descriptors.
1. Diagnosing auth failures, callback mismatches, and drift after upstream changes.
1. Rolling connector versions forward safely with certification coverage.
1. Reconciling provider-side state with UOS expectations.
1. Hardening policy around scopes, retries, rate limits, and tenancy boundaries.

## 11. Interfaces and Dependencies

- Paperclip plugin scaffold for worker, manifest, UI, and validation surfaces.

- `@uos/core` for orchestration and lifecycle control.
- External provider APIs, SDKs, webhooks, and auth systems.
- Department overlays consuming provider-backed capabilities.
- `@uos/plugin-operations-cockpit` for observability and review surfaces.

## 12. Implementation Backlog

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

## 13. Risks and Mitigations

- Undocumented provider drift creating recurring breakages.
- Auth complexity leaking across the platform.
- Connector-specific logic becoming impossible to reason about globally.
- Policy exceptions multiplying faster than certification coverage.

## 14. Definition of Done

A task in this repo is only complete when all of the following are true:

- The code, configuration, or skill behavior has been updated with clear intent.
- Tests, evals, replay cases, or validation artifacts were added or updated to protect the changed behavior.
- Documentation, runbooks, or decision records were updated when the behavior, contract, or operating model changed.
- The task produced a durable learning artifact rather than only a code diff.
- Cross-repo consequences were checked wherever this repo touches shared contracts, orchestration, or downstream users.

### Repo-specific completion requirements
- Provider behavior is represented in capability and certification artifacts.
- Auth/callback changes include failure-mode analysis and recovery paths.
- Operational telemetry exists for the new or changed behavior.

## 15. Recommended Repo-Local Knowledge Layout

- `/docs/research/` for research briefs, benchmark notes, and upstream findings.
- `/docs/adrs/` for decision records and contract changes.
- `/docs/lessons/` for task-by-task learning artifacts and postmortems.
- `/evals/` for executable quality checks, golden cases, and regression suites.
- `/playbooks/` for operator runbooks, migration guides, and incident procedures.
