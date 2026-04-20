import { describe, expect, it } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

describe("plugin scaffold", () => {
  it("registers data, actions, and event handling", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities, "events.emit"] });
    await plugin.definition.setup(harness.ctx);

    await harness.emit("issue.created", { issueId: "iss_1" }, { entityId: "iss_1", entityType: "issue" });
    expect(harness.getState({ scopeKind: "issue", scopeId: "iss_1", stateKey: "seen" })).toBe(true);

    const data = await harness.getData<{ status: string; checkedAt: string }>("health");
    expect(data.status).toBe("ok");

    const action = await harness.performAction<{ pong: boolean; at: string }>("ping");
    expect(action.pong).toBe(true);
  });

  it("registers connector platform capabilities", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities, "events.emit"] });
    await plugin.definition.setup(harness.ctx);

    // Health should include connector count
    const health = await harness.getData<{ certifiedConnectors: number }>("health");
    expect(health.certifiedConnectors).toBeGreaterThan(0);

    // List certified providers
    const certified = await harness.getData<{ providers: Array<{ providerId: string }> }>("listCertifiedProviders");
    expect(certified.providers.length).toBeGreaterThan(0);

    // Get a specific provider capability
    const capability = await harness.getData<{ providerId: string }>("providerCapability", { providerId: "slack" });
    expect(capability.providerId).toBe("slack");

    // Get capability summary
    const summary = await harness.getData<{ summary?: string }>("capabilitySummary", { providerId: "github" });
    expect(summary.summary).toBeDefined();
  });

  it("classifies connector failures with recovery guidance", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities, "events.emit"] });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.performAction<{
      failure: { category: string; severity: string };
      display: string;
      requiresImmediateAttention: boolean;
    }>("classifyFailure", {
      providerId: "slack",
      errorMessage: "token_expired"
    });

    expect(result.failure.category).toBe("auth_expired");
    expect(result.failure.severity).toBe("high");
    expect(result.requiresImmediateAttention).toBe(true);
    expect(result.display).toContain("Authentication");
  });

  it("checks connector promotion eligibility", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities, "events.emit"] });
    await plugin.definition.setup(harness.ctx);

    // Test with no test results (in progress)
    const result = await harness.performAction<{
      report: { status: string; overallAssessment: { passed: boolean } };
    }>("checkPromotionEligibility", { providerId: "github" });

    expect(result.report.status).toBeDefined();
    expect(typeof result.report.overallAssessment.passed).toBe("boolean");
  });

  it("generates reconnection plans for auth failures", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities, "events.emit"] });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.performAction<{
      plan: { state: string; reconnectType: string };
      display: string;
    }>("generateReconnectPlan", {
      providerId: "slack",
      errorMessage: "token_expired"
    });

    expect(result.plan.state).toBe("auth_expired");
    // Without authEndpoints passed, it defaults to full_reauth
    expect(result.plan.reconnectType).toBe("full_reauth");
    expect(result.display).toContain("RECONNECT");
  });


  it("classifies rate limit conditions with retry timing", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities, "events.emit"] });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.performAction<{
      classification: { severity: string; retryTiming: { recommendedDelayMs: number } };
      display: string;
    }>("classifyRateLimit", {
      providerId: "github",
      headers: {
        "x-rate-limit-remaining": "5",
        "x-rate-limit-limit": "100",
        "retry-after": "30"
      },
      statusCode: 429
    });

    expect(result.classification.severity).toBe("high");
    expect(result.classification.retryTiming.recommendedDelayMs).toBeGreaterThan(0);
    expect(result.display).toContain("RATE LIMIT");
  });

  it("reconciles missed callbacks through the plugin runtime surface", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities, "events.emit"] });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.performAction<{
      result: { status: string; totalReplayed: number; totalUnresolved: number; stateConsistent: boolean };
      replaySummary: { replayed: number; unresolved: number; stateConsistent: boolean };
      unresolvedItems: Array<{ eventId: string; recommendedHandling: string }>;
      replayGuidance: Array<{ type: string; required: boolean }>;
      display: string;
    }>("reconcileCallbacks", {
      providerId: "slack",
      gaps: [
        {
          eventType: "message.created",
          gapStart: "2026-04-03T10:00:00Z",
          gapEnd: "2026-04-03T11:00:00Z",
          reason: "provider_outage",
          replaySuccessRate: 0.5,
          estimatedMissedCount: 4
        }
      ]
    });

    expect(result.result.status).toBe("partial");
    expect(result.result.totalReplayed).toBe(2);
    expect(result.result.totalUnresolved).toBe(2);
    expect(result.replaySummary.unresolved).toBe(2);
    expect(result.unresolvedItems).toHaveLength(2);
    expect(result.unresolvedItems[0]?.recommendedHandling).toBe("manual_review");
    expect(result.replayGuidance.some((action) => action.type === "manual_review" && action.required)).toBe(true);
    expect(result.display).toContain("CALLBACK RECONCILIATION REPORT");
  });

  it("provides certification criteria", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities, "events.emit"] });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.getData<{ criteria: Array<{ id: string; name: string }> }>("certificationCriteria");
    expect(result.criteria.length).toBeGreaterThan(0);
    expect(result.criteria[0].id).toBeDefined();
    expect(result.criteria[0].name).toBeDefined();
  });

  it("stores connector accounts strictly in company scope", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities, "events.emit"] });
    await plugin.definition.setup(harness.ctx);

    const saved = await harness.performAction<{
      companyId: string;
      connection: { id: string; companyId: string; label: string };
    }>("upsertCompanyConnection", {
      companyId: "company-a",
      connection: {
        providerId: "slack",
        label: "Kurs.ing Support Slack",
        accountIdentifier: "kursing-support",
        usage: "support",
        status: "connected",
      },
    });

    expect(saved.companyId).toBe("company-a");
    expect(saved.connection.companyId).toBe("company-a");

    const companyA = await harness.getData<{
      companyId: string;
      connections: Array<{ label: string; companyId: string }>;
    }>("companyConnections", { companyId: "company-a" });
    const companyB = await harness.getData<{
      companyId: string;
      connections: Array<{ label: string; companyId: string }>;
    }>("companyConnections", { companyId: "company-b" });

    expect(companyA.connections).toHaveLength(1);
    expect(companyA.connections[0]?.label).toBe("Kurs.ing Support Slack");
    expect(companyB.connections).toHaveLength(0);
  });
});

// Test connector modules directly
describe("connector capability registry", () => {
  it("gets provider capability descriptors", async () => {
    const { getProviderCapability, listProviders, listCertifiedProviders } = await import("../src/connectors/capability-registry.js");
    
    const slack = getProviderCapability("slack");
    expect(slack).toBeDefined();
    expect(slack?.providerId).toBe("slack");
    expect(slack?.authModel).toContain("oauth2");
    expect(slack?.certified).toBe(true);
    
    const github = getProviderCapability("github");
    expect(github).toBeDefined();
    expect(github?.eventModel).toBe("webhook");
    
    const unknown = getProviderCapability("unknown_provider");
    expect(unknown).toBeUndefined();
  });

  it("lists providers correctly", async () => {
    const { listProviders, listCertifiedProviders } = await import("../src/connectors/capability-registry.js");
    
    const allProviders = listProviders();
    expect(allProviders.length).toBeGreaterThan(0);
    expect(allProviders).toContain("slack");
    expect(allProviders).toContain("github");
    
    const certified = listCertifiedProviders();
    expect(certified.length).toBeGreaterThan(0);
    expect(certified.every(p => p.certified)).toBe(true);
  });

  it("generates capability summaries", async () => {
    const { generateCapabilitySummary } = await import("../src/connectors/capability-registry.js");
    
    const summary = generateCapabilitySummary("stripe");
    expect(summary).toBeDefined();
    expect(summary).toContain("Stripe");
    expect(summary).toContain("Certified: Yes");
  });
});

describe("failure classifier", () => {
  it("classifies auth_expired failures", async () => {
    const { classifyFailure, isRetryable, requiresImmediateAttention } = await import("../src/connectors/failure-classifier.js");
    
    const failure = classifyFailure({
      providerId: "slack",
      errorMessage: "Token expired"
    });
    
    expect(failure.category).toBe("auth_expired");
    expect(failure.severity).toBe("high");
    expect(failure.retryable).toBe(false); // Token refresh needed, not retry
    expect(requiresImmediateAttention(failure)).toBe(true);
    expect(failure.recoveryActions.length).toBeGreaterThan(0);
  });

  it("classifies rate_limit failures with headers", async () => {
    const { classifyFailure } = await import("../src/connectors/failure-classifier.js");
    
    const failure = classifyFailure({
      providerId: "github",
      statusCode: 429,
      headers: {
        "x-rate-limit-remaining": "0",
        "retry-after": "60"
      }
    });
    
    expect(failure.category).toBe("rate_limit");
    expect(failure.severity).toBe("medium");
    expect(failure.retryable).toBe(true);
    expect(failure.suggestedRetryDelayMs).toBeGreaterThan(0);
  });

  it("classifies callback_mismatch from error message", async () => {
    const { classifyFailure } = await import("../src/connectors/failure-classifier.js");
    
    const failure = classifyFailure({
      providerId: "stripe",
      errorMessage: "Webhook signature verification failed"
    });
    
    expect(failure.category).toBe("callback_mismatch");
    expect(failure.severity).toBe("high");
  });

  it("sanitizes sensitive data from display messages", async () => {
    const { classifyFailure } = await import("../src/connectors/failure-classifier.js");
    
    const failure = classifyFailure({
      providerId: "github",
      errorMessage: "Bearer abc123_token_secret"
    });
    
    expect(failure.displayMessage).not.toContain("abc123");
    expect(failure.displayMessage).toContain("[token]");
  });
});

describe("certification", () => {
  it("checks promotion eligibility", async () => {
    const { checkPromotionEligibility, isCertifiedForProduction } = await import("../src/connectors/certification.js");
    
    // Without test results, should be incomplete/uncertified due to in_progress required criteria
    const report = checkPromotionEligibility("github");
    expect(report.status).toBe("uncertified");
    expect(report.overallAssessment.passed).toBe(false);
    expect(report.promotionBlockers.length).toBeGreaterThan(0);
    
    // With all required tests passed
    const allPassed: Record<string, "passed" | "failed" | "pending"> = {
      // Required criteria
      "smoke:core_operations": "passed",
      "smoke:authentication": "passed",
      "contract:event_handling": "passed",
      "review:fallback_availability": "passed",
      "contract:fallback_tested": "passed",
      "contract:audit_events": "passed",
      "contract:error_audit": "passed",
      "automated:telemetry": "passed",
      "review:scope_minimization": "passed",
      "review:token_storage": "passed",
      "automated:callback_validation": "passed",
      "contract:retry_logic": "passed",
      "smoke:rate_limits": "passed",
      "contract:reconciliation": "passed",
      // Optional criteria (still need to be set)
      "smoke:degraded_mode": "passed",
      "review:circuit_breaker": "passed"
    };
    const certifiedReport = checkPromotionEligibility("github", allPassed);
    expect(isCertifiedForProduction(certifiedReport)).toBe(true);
  });

  it("generates certification summaries", async () => {
    const { checkPromotionEligibility, generateCertificationSummary } = await import("../src/connectors/certification.js");
    
    const report = checkPromotionEligibility("github");
    const summary = generateCertificationSummary(report);
    
    expect(summary).toContain("CONNECTOR CERTIFICATION REPORT");
    expect(summary).toContain("github");
  });
});

describe("reconnect flow", () => {
  it("generates reconnection plans for expired auth", async () => {
    const { generateReconnectPlan, createReconnectPlanFromFailure } = await import("../src/connectors/reconnect.js");
    
    const { classifyFailure } = await import("../src/connectors/failure-classifier.js");
    const failure = classifyFailure({
      providerId: "slack",
      errorMessage: "token_expired"
    });
    
    const plan = generateReconnectPlan({
      providerId: "slack",
      failure,
      authEndpoints: {
        authorization: "https://slack.com/oauth/v2/authorize",
        refresh: "https://slack.com/api/oauth.v2.access"
      }
    });
    
    expect(plan.state).toBe("auth_expired");
    expect(plan.reconnectType).toBe("token_refresh");
    expect(plan.requiresUserAction).toBe(true);
    expect(plan.instructions.length).toBeGreaterThan(0);
  });

  it("preserves workflow context", async () => {
    const { preserveWorkflowContext } = await import("../src/connectors/reconnect.js");
    
    const context = preserveWorkflowContext({
      workflowId: "wf_123",
      workflowType: "issue_sync",
      description: "Sync issues from GitHub",
      currentStep: "fetch_comments",
      completedSteps: ["authenticate", "fetch_issues", "fetch_comments"],
      pendingSteps: ["update_db", "send_notifications"],
      inputParameters: { repo: "test/repo" },
      intermediateResults: { lastSyncId: "issue_456" }
    });
    
    expect(context.workflowId).toBe("wf_123");
    expect(context.completedSteps).toEqual(["authenticate", "fetch_issues", "fetch_comments"]);
    expect(context.pendingSteps).toEqual(["update_db", "send_notifications"]);
    expect(context.interruptedAt).toBeDefined();
  });
});

describe("rate limit visibility", () => {
  it("classifies rate limits with usage info", async () => {
    const { classifyRateLimit } = await import("../src/connectors/rate-limit.js");
    
    const classification = classifyRateLimit({
      providerId: "github",
      statusCode: 429,
      headers: {
        "x-rate-limit-remaining": "5",
        "x-rate-limit-limit": "100",
        "retry-after": "30"
      },
      attemptNumber: 1
    });
    
    expect(classification.severity).toBe("high");
    expect(classification.usage?.remaining).toBe(5);
    expect(classification.usage?.limit).toBe(100);
    expect(classification.retryTiming.recommendedDelayMs).toBeGreaterThan(0);
    expect(classification.impact.degradationLevel).toBe("significant");
  });

  it("calculates exponential backoff delay", async () => {
    const { calculateBackoffDelay } = await import("../src/connectors/rate-limit.js");
    
    // First attempt
    const delay1 = calculateBackoffDelay({
      strategy: "exponential",
      attemptNumber: 1,
      baseDelayMs: 1000,
      maxDelayMs: 30000
    });
    expect(delay1).toBe(1000); // 1000 * 2^0 = 1000
    
    // Second attempt
    const delay2 = calculateBackoffDelay({
      strategy: "exponential",
      attemptNumber: 2,
      baseDelayMs: 1000,
      maxDelayMs: 30000
    });
    expect(delay2).toBe(2000); // 1000 * 2^1 = 2000
    
    // Third attempt
    const delay3 = calculateBackoffDelay({
      strategy: "exponential",
      attemptNumber: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000
    });
    expect(delay3).toBe(4000); // 1000 * 2^2 = 4000
  });

  it("respects max delay cap", async () => {
    const { calculateBackoffDelay } = await import("../src/connectors/rate-limit.js");
    
    const delay = calculateBackoffDelay({
      strategy: "exponential",
      attemptNumber: 10,
      baseDelayMs: 1000,
      maxDelayMs: 30000
    });
    expect(delay).toBe(30000); // Capped at max
  });
});

describe("callback reconciliation", () => {
  it("detects time-based gaps", async () => {
    const { detectTimeBasedGaps } = await import("../src/connectors/callback-reconciliation.js");
    
    const gap = detectTimeBasedGaps({
      providerId: "slack",
      eventType: "message.created",
      expectedFrequencyMinutes: 5,
      gapStart: "2026-04-03T10:00:00Z",
      gapEnd: "2026-04-03T11:00:00Z",
      reason: "provider_outage",
      receivedEvents: [] // No events received in this window
    });
    
    expect(gap.providerId).toBe("slack");
    expect(gap.eventType).toBe("message.created");
    expect(gap.estimatedMissedCount).toBe(12); // 60 minutes / 5 = 12
    expect(gap.reconciled).toBe(false);
  });

  it("creates reconciliation results", async () => {
    const { createReconciliationResult, detectTimeBasedGaps } = await import("../src/connectors/callback-reconciliation.js");
    
    const gap = detectTimeBasedGaps({
      providerId: "slack",
      eventType: "message.created",
      expectedFrequencyMinutes: 5,
      gapStart: "2026-04-03T10:00:00Z",
      gapEnd: "2026-04-03T11:00:00Z",
      reason: "provider_outage",
      receivedEvents: []
    });
    
    // Simulate replay
    gap.replayedEvents = [{ id: "replayed_1", providerId: "slack", eventType: "message.created", processed: true, processingResult: "success", source: "polling" }];
    gap.reconciled = true;
    
    const result = createReconciliationResult({
      providerId: "slack",
      detectedGaps: [gap],
      status: "replayed"
    });
    
    expect(result.status).toBe("replayed");
    expect(result.totalReplayed).toBe(1);
    expect(result.stateConsistent).toBe(true);
  });
});
