import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import {
  getProviderCapability,
  listProviders,
  listCertifiedProviders,
  generateCapabilitySummary
} from "./connectors/capability-registry.js";
import {
  classifyFailure,
  formatFailureForOperator,
  requiresImmediateAttention,
  type FailureClassification
} from "./connectors/failure-classifier.js";
import {
  checkPromotionEligibility,
  generateCertificationSummary,
  CERTIFICATION_CRITERIA
} from "./connectors/certification.js";
import {
  generateReconnectPlan,
  createReconnectPlanFromFailure,
  formatReconnectPlanForOperator,
  type ReconnectPlan,
  type WorkflowContext
} from "./connectors/reconnect.js";
import {
  classifyRateLimit,
  formatRateLimitForOperator
} from "./connectors/rate-limit.js";
import {
  formatReconciliationForOperator,
  simulateReconciliation
} from "./connectors/callback-reconciliation.js";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.events.on("issue.created", async (event) => {
      const issueId = event.entityId ?? "unknown";
      await ctx.state.set({ scopeKind: "issue", scopeId: issueId, stateKey: "seen" }, true);
      ctx.logger.info("Observed issue.created", { issueId });
    });

    // Health check with connector status
    ctx.data.register("health", async () => {
      const certifiedProviders = listCertifiedProviders();
      return { 
        status: "ok", 
        checkedAt: new Date().toISOString(),
        certifiedConnectors: certifiedProviders.length
      };
    });

    // Ping action
    ctx.actions.register("ping", async () => {
      ctx.logger.info("Ping action invoked");
      return { pong: true, at: new Date().toISOString() };
    });

    // Provider capability lookup
    ctx.data.register("providerCapability", async (args: Record<string, unknown>) => {
      const providerId = args.providerId as string;
      const capability = getProviderCapability(providerId);
      if (!capability) {
        return { error: `Provider '${providerId}' not found` };
      }
      return capability;
    });

    // List all providers
    ctx.data.register("listProviders", async () => {
      return { providers: listProviders() };
    });

    // List certified providers
    ctx.data.register("listCertifiedProviders", async () => {
      const certified = listCertifiedProviders();
      return { 
        providers: certified.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName,
          category: p.category,
          certified: p.certified
        }))
      };
    });

    // Get capability summary for operator display
    ctx.data.register("capabilitySummary", async (args: Record<string, unknown>) => {
      const providerId = args.providerId as string;
      const summary = generateCapabilitySummary(providerId);
      if (!summary) {
        return { error: `Provider '${providerId}' not found` };
      }
      return { summary };
    });

    // Classify a connector failure
    ctx.actions.register("classifyFailure", async (args: Record<string, unknown>) => {
      const failure = classifyFailure({
        providerId: args.providerId as string,
        errorMessage: args.errorMessage as string | undefined,
        statusCode: args.statusCode as number | undefined,
        headers: args.headers as Record<string, string> | undefined
      });
      return {
        failure,
        display: formatFailureForOperator(failure),
        requiresImmediateAttention: requiresImmediateAttention(failure)
      };
    });

    // Check connector promotion eligibility
    ctx.actions.register("checkPromotionEligibility", async (args: Record<string, unknown>) => {
      const report = checkPromotionEligibility(
        args.providerId as string,
        args.testResults as Record<string, "passed" | "failed" | "pending"> | undefined
      );
      return {
        report,
        display: generateCertificationSummary(report)
      };
    });

    // Generate reconnection plan
    ctx.actions.register("generateReconnectPlan", async (args: Record<string, unknown>) => {
      const plan = createReconnectPlanFromFailure({
        providerId: args.providerId as string,
        errorMessage: args.errorMessage as string | undefined,
        statusCode: args.statusCode as number | undefined,
        headers: args.headers as Record<string, string> | undefined,
        workflowContext: args.workflowContext as WorkflowContext | undefined
      });
      return {
        plan,
        display: formatReconnectPlanForOperator(plan)
      };
    });

    // Classify rate limit condition
    ctx.actions.register("classifyRateLimit", async (args: Record<string, unknown>) => {
      const classification = classifyRateLimit({
        providerId: args.providerId as string,
        headers: args.headers as Record<string, string> | undefined,
        statusCode: args.statusCode as number | undefined,
        errorMessage: args.errorMessage as string | undefined,
        attemptNumber: args.attemptNumber as number | undefined
      });
      return {
        classification,
        display: formatRateLimitForOperator(classification)
      };
    });

    // Reconcile missed callbacks after provider or transport outage
    ctx.actions.register("reconcileCallbacks", async (args: Record<string, unknown>) => {
      const result = simulateReconciliation({
        providerId: args.providerId as string,
        gaps: (args.gaps as Array<{
          eventType: string;
          gapStart: string;
          gapEnd: string;
          reason:
            | "provider_outage"
            | "transport_failure"
            | "endpoint_unavailable"
            | "auth_expired"
            | "rate_limited"
            | "unknown";
          replaySuccessRate: number;
          estimatedMissedCount?: number;
        }> | undefined) ?? []
      });

      return {
        result,
        display: formatReconciliationForOperator(result),
        replaySummary: {
          replayed: result.totalReplayed,
          unresolved: result.totalUnresolved,
          stateConsistent: result.stateConsistent
        },
        unresolvedItems: result.detectedGaps.flatMap((gap) =>
          gap.unresolvedEvents.map((event) => ({
            gapId: gap.id,
            providerId: gap.providerId,
            eventType: event.eventType,
            eventId: event.id,
            errorMessage: event.errorMessage ?? "Unknown replay failure",
            recommendedHandling: "manual_review"
          }))
        ),
        replayGuidance: result.recommendedActions.map((action) => ({
          id: action.id,
          type: action.type,
          priority: action.priority,
          required: action.required,
          description: action.description
        }))
      };
    });

    // Get certification criteria
    ctx.data.register("certificationCriteria", async () => {
      return { criteria: CERTIFICATION_CRITERIA };
    });
  },

  async onHealth() {
    return { 
      status: "ok", 
      message: "Plugin worker is running with connector capabilities",
      version: "0.1.0"
    };
  }
});

export default plugin;
runWorker(plugin, import.meta.url);
