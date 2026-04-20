import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import {
  getProviderCapability,
  listProviders,
  listCertifiedProviders,
  generateCapabilitySummary,
} from "./connectors/capability-registry.js";
import {
  classifyFailure,
  formatFailureForOperator,
  requiresImmediateAttention,
} from "./connectors/failure-classifier.js";
import {
  checkPromotionEligibility,
  generateCertificationSummary,
  CERTIFICATION_CRITERIA,
} from "./connectors/certification.js";
import {
  createReconnectPlanFromFailure,
  formatReconnectPlanForOperator,
  type WorkflowContext,
} from "./connectors/reconnect.js";
import {
  classifyRateLimit,
  formatRateLimitForOperator,
} from "./connectors/rate-limit.js";
import {
  formatReconciliationForOperator,
  simulateReconciliation,
} from "./connectors/callback-reconciliation.js";
import type { PluginContext } from "@paperclipai/plugin-sdk";
import type { ProviderCapabilityDescriptor } from "./connectors/capability-registry.js";
import {
  CONNECTIONS_NAMESPACE,
  CONNECTIONS_STATE_KEY,
  assertCompanyId,
  mergeCompanyConnection,
  normalizeCompanyConnection,
  sortCompanyConnections,
  summarizeCompanyConnections,
  type CompanyConnectionDraft,
  type CompanyConnectionRecord,
  type CompanyConnectionStatus,
} from "./company-connections.js";
import { listConnectorQuickStartBundles, listConnectorQuickStarts } from "./quick-starts.js";

async function loadCompanyConnections(ctx: PluginContext, companyId: string): Promise<CompanyConnectionRecord[]> {
  const state = await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: CONNECTIONS_NAMESPACE,
    stateKey: CONNECTIONS_STATE_KEY,
  });

  if (!Array.isArray(state)) return [];
  return sortCompanyConnections(
    state.filter((value): value is CompanyConnectionRecord => Boolean(value) && typeof value === "object")
      .map((value) => value as CompanyConnectionRecord)
      .filter((value) => value.companyId === companyId),
  );
}

async function saveCompanyConnections(ctx: PluginContext, companyId: string, records: CompanyConnectionRecord[]) {
  await ctx.state.set(
    {
      scopeKind: "company",
      scopeId: companyId,
      namespace: CONNECTIONS_NAMESPACE,
      stateKey: CONNECTIONS_STATE_KEY,
    },
    sortCompanyConnections(records),
  );
}

function buildProviderCatalog() {
  return listProviders()
    .map((providerId) => getProviderCapability(providerId))
    .filter((provider): provider is ProviderCapabilityDescriptor => Boolean(provider))
    .map((provider) => ({
      providerId: provider.providerId,
      displayName: provider.displayName,
      category: provider.category,
      certified: provider.certified,
      authModel: provider.authModel,
      eventModel: provider.eventModel,
      writeBoundary: provider.writeBoundary,
      supportsTokenRefresh: provider.supportsTokenRefresh,
      lifecycleState: provider.lifecycleState ?? "stable",
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.events.on("issue.created", async (event) => {
      const issueId = event.entityId ?? "unknown";
      await ctx.state.set({ scopeKind: "issue", scopeId: issueId, stateKey: "seen" }, true);
      ctx.logger.info("Observed issue.created", { issueId });
    });

    ctx.data.register("health", async (args: Record<string, unknown>) => {
      const companyId = typeof args.companyId === "string" ? args.companyId : "";
      const certifiedProviders = listCertifiedProviders();
      const providerCatalog = buildProviderCatalog();
      const connections = companyId ? await loadCompanyConnections(ctx, companyId) : [];
      return {
        status: "ok",
        checkedAt: new Date().toISOString(),
        certifiedConnectors: certifiedProviders.length,
        totalProviders: providerCatalog.length,
        companyId: companyId || null,
        companyConnections: connections.length,
        companyWarnings: summarizeCompanyConnections(connections).warnings,
      };
    });

    ctx.actions.register("ping", async () => {
      ctx.logger.info("Ping action invoked");
      return { pong: true, at: new Date().toISOString() };
    });

    ctx.data.register("providerCapability", async (args: Record<string, unknown>) => {
      const providerId = args.providerId as string;
      const capability = getProviderCapability(providerId);
      if (!capability) {
        return { error: `Provider '${providerId}' not found` };
      }
      return capability;
    });

    ctx.data.register("providerCatalog", async () => ({
      providers: buildProviderCatalog(),
    }));

    ctx.data.register("listProviders", async () => ({
      providers: listProviders(),
    }));

    ctx.data.register("listCertifiedProviders", async () => {
      const certified = listCertifiedProviders();
      return {
        providers: certified.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          category: provider.category,
          certified: provider.certified,
        })),
      };
    });

    ctx.data.register("capabilitySummary", async (args: Record<string, unknown>) => {
      const providerId = args.providerId as string;
      const summary = generateCapabilitySummary(providerId);
      if (!summary) {
        return { error: `Provider '${providerId}' not found` };
      }
      return { summary };
    });

    ctx.data.register("companyConnections", async (args: Record<string, unknown>) => {
      const companyId = assertCompanyId(args.companyId);
      const connections = await loadCompanyConnections(ctx, companyId);
      return {
        companyId,
        connections,
        summary: summarizeCompanyConnections(connections),
      };
    });

    ctx.data.register("companyConnectorSummary", async (args: Record<string, unknown>) => {
      const companyId = assertCompanyId(args.companyId);
      const connections = await loadCompanyConnections(ctx, companyId);
      return {
        companyId,
        summary: summarizeCompanyConnections(connections),
      };
    });

    ctx.data.register("quickStartCatalog", async () => ({
      quickStarts: listConnectorQuickStarts(),
      bundles: listConnectorQuickStartBundles(),
    }));

    ctx.actions.register("upsertCompanyConnection", async (args: Record<string, unknown>) => {
      const companyId = assertCompanyId(args.companyId);
      const draft = (args.connection ?? {}) as CompanyConnectionDraft;
      const nextRecord = normalizeCompanyConnection(companyId, draft);
      const existingRecords = await loadCompanyConnections(ctx, companyId);
      const existing = existingRecords.find((record) => record.id === nextRecord.id);
      const merged = mergeCompanyConnection(existing, nextRecord);
      const nextRecords = existing
        ? existingRecords.map((record) => (record.id === existing.id ? merged : record))
        : [...existingRecords, merged];

      await saveCompanyConnections(ctx, companyId, nextRecords);
      ctx.logger.info("Stored company-scoped connector account", {
        companyId,
        connectionId: merged.id,
        providerId: merged.providerId,
        accountIdentifier: merged.accountIdentifier,
      });

      return {
        companyId,
        connection: merged,
        summary: summarizeCompanyConnections(nextRecords),
      };
    });

    ctx.actions.register("deleteCompanyConnection", async (args: Record<string, unknown>) => {
      const companyId = assertCompanyId(args.companyId);
      const connectionId = typeof args.connectionId === "string" ? args.connectionId.trim() : "";
      if (!connectionId) {
        throw new Error("connectionId is required");
      }

      const existingRecords = await loadCompanyConnections(ctx, companyId);
      const nextRecords = existingRecords.filter((record) => record.id !== connectionId);
      await saveCompanyConnections(ctx, companyId, nextRecords);

      return {
        companyId,
        deletedConnectionId: connectionId,
        summary: summarizeCompanyConnections(nextRecords),
      };
    });

    ctx.actions.register("setCompanyConnectionStatus", async (args: Record<string, unknown>) => {
      const companyId = assertCompanyId(args.companyId);
      const connectionId = typeof args.connectionId === "string" ? args.connectionId.trim() : "";
      const status = typeof args.status === "string" ? args.status.trim() as CompanyConnectionStatus : "";
      if (!connectionId) {
        throw new Error("connectionId is required");
      }
      if (!status) {
        throw new Error("status is required");
      }

      const existingRecords = await loadCompanyConnections(ctx, companyId);
      const target = existingRecords.find((record) => record.id === connectionId);
      if (!target) {
        throw new Error(`Connection '${connectionId}' not found for company`);
      }

      const updated = {
        ...target,
        status,
        updatedAt: new Date().toISOString(),
        lastValidatedAt:
          typeof args.lastValidatedAt === "string" && args.lastValidatedAt.trim().length > 0
            ? args.lastValidatedAt
            : target.lastValidatedAt ?? null,
        lastValidationMessage:
          typeof args.lastValidationMessage === "string"
            ? args.lastValidationMessage.trim() || null
            : target.lastValidationMessage ?? null,
      };

      const nextRecords = existingRecords.map((record) => (record.id === connectionId ? updated : record));
      await saveCompanyConnections(ctx, companyId, nextRecords);

      return {
        companyId,
        connection: updated,
        summary: summarizeCompanyConnections(nextRecords),
      };
    });

    ctx.actions.register("classifyFailure", async (args: Record<string, unknown>) => {
      const failure = classifyFailure({
        providerId: args.providerId as string,
        errorMessage: args.errorMessage as string | undefined,
        statusCode: args.statusCode as number | undefined,
        headers: args.headers as Record<string, string> | undefined,
      });
      return {
        failure,
        display: formatFailureForOperator(failure),
        requiresImmediateAttention: requiresImmediateAttention(failure),
      };
    });

    ctx.actions.register("checkPromotionEligibility", async (args: Record<string, unknown>) => {
      const report = checkPromotionEligibility(
        args.providerId as string,
        args.testResults as Record<string, "passed" | "failed" | "pending"> | undefined,
      );
      return {
        report,
        display: generateCertificationSummary(report),
      };
    });

    ctx.actions.register("generateReconnectPlan", async (args: Record<string, unknown>) => {
      const plan = createReconnectPlanFromFailure({
        providerId: args.providerId as string,
        errorMessage: args.errorMessage as string | undefined,
        statusCode: args.statusCode as number | undefined,
        headers: args.headers as Record<string, string> | undefined,
        workflowContext: args.workflowContext as WorkflowContext | undefined,
      });
      return {
        plan,
        display: formatReconnectPlanForOperator(plan),
      };
    });

    ctx.actions.register("classifyRateLimit", async (args: Record<string, unknown>) => {
      const classification = classifyRateLimit({
        providerId: args.providerId as string,
        headers: args.headers as Record<string, string> | undefined,
        statusCode: args.statusCode as number | undefined,
        errorMessage: args.errorMessage as string | undefined,
        attemptNumber: args.attemptNumber as number | undefined,
      });
      return {
        classification,
        display: formatRateLimitForOperator(classification),
      };
    });

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
        }> | undefined) ?? [],
      });

      return {
        result,
        display: formatReconciliationForOperator(result),
        replaySummary: {
          replayed: result.totalReplayed,
          unresolved: result.totalUnresolved,
          stateConsistent: result.stateConsistent,
        },
        unresolvedItems: result.detectedGaps.flatMap((gap) =>
          gap.unresolvedEvents.map((event) => ({
            gapId: gap.id,
            providerId: gap.providerId,
            eventType: event.eventType,
            eventId: event.id,
            errorMessage: event.errorMessage ?? "Unknown replay failure",
            recommendedHandling: "manual_review",
          })),
        ),
        replayGuidance: result.recommendedActions.map((action) => ({
          id: action.id,
          type: action.type,
          priority: action.priority,
          required: action.required,
          description: action.description,
        })),
      };
    });

    ctx.data.register("certificationCriteria", async () => ({
      criteria: CERTIFICATION_CRITERIA,
    }));
  },

  async onHealth() {
    return {
      status: "ok",
      message: "Plugin worker is running with connector capabilities and company-scoped account registry",
      version: "0.3.0",
    };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
