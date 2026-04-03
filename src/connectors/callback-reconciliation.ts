/**
 * Callback Reconciliation
 * 
 * Detects and reconciles missed callbacks after provider or transport outages,
 * reports replayed and unresolved items, and restores consistent state.
 * 
 * This module implements UOS-FOUND-CONN-005: Missed callbacks can be reconciled 
 * after provider or transport outage.
 */

export type ReconciliationStatus =
  | "idle"                    // No reconciliation needed
  | "detecting_gaps"         // Actively detecting callback gaps
  | "reconciling"            // Reconciliation in progress
  | "replayed"                // Replay completed successfully
  | "partial"                // Partial reconciliation - some items unresolved
  | "failed"                 // Reconciliation failed
  | "no_gaps_found";         // No gaps detected

export type GapReason =
  | "provider_outage"        // Provider experienced an outage
  | "transport_failure"       // Network/transport failure
  | "endpoint_unavailable"   // Callback endpoint was down
  | "auth_expired"           // Auth expired during outage
  | "rate_limited"           // Temporarily rate limited
  | "unknown";               // Unknown cause

export interface CallbackEvent {
  /** Unique event identifier */
  id: string;
  
  /** Provider that sent/delivered the callback */
  providerId: string;
  
  /** Event type (e.g., "issue.created", "payment.completed") */
  eventType: string;
  
  /** Expected delivery timestamp */
  expectedAt?: string;
  
  /** Actual delivery timestamp */
  deliveredAt?: string;
  
  /** Whether the callback was successfully processed */
  processed: boolean;
  
  /** Processing result if failed */
  processingResult?: "success" | "failed" | "duplicate" | "skipped";
  
  /** Error message if processing failed */
  errorMessage?: string;
  
  /** Sequence number if available */
  sequenceNumber?: number;
  
  /** Source of the callback (webhook, polling, etc.) */
  source: "webhook" | "polling" | "websocket" | "manual";
  
  /** Payload hash for deduplication */
  payloadHash?: string;
}

export interface CallbackGap {
  /** Unique gap identifier */
  id: string;
  
  /** Provider with the gap */
  providerId: string;
  
  /** Event type that was missed */
  eventType: string;
  
  /** Start of the gap window */
  gapStart: string;
  
  /** End of the gap window */
  gapEnd: string;
  
  /** Reason the gap occurred */
  reason: GapReason;
  
  /** Number of events potentially missed */
  estimatedMissedCount: number;
  
  /** Whether the gap has been reconciled */
  reconciled: boolean;
  
  /** Events that were replayed to fill the gap */
  replayedEvents: CallbackEvent[];
  
  /** Events that could not be replayed */
  unresolvedEvents: CallbackEvent[];
}

export interface ReconciliationResult {
  /** Unique reconciliation identifier */
  id: string;
  
  /** Provider that was reconciled */
  providerId: string;
  
  /** Overall reconciliation status */
  status: ReconciliationStatus;
  
  /** When reconciliation was started */
  startedAt: string;
  
  /** When reconciliation completed */
  completedAt?: string;
  
  /** Gaps that were detected */
  detectedGaps: CallbackGap[];
  
  /** Total events replayed */
  totalReplayed: number;
  
  /** Total events unresolved */
  totalUnresolved: number;
  
  /** Whether state is now consistent */
  stateConsistent: boolean;
  
  /** Warnings or notes about the reconciliation */
  warnings?: string[];
  
  /** Errors encountered during reconciliation */
  errors?: string[];
  
  /** Recommended follow-up actions */
  recommendedActions: ReconciliationAction[];
  
  /** Summary for operators */
  summary: string;
}

export interface ReconciliationAction {
  /** Action identifier */
  id: string;
  
  /** Action type */
  type: "manual_review" | "retry" | "discard" | "escalate" | "monitor";
  
  /** Description of the action */
  description: string;
  
  /** Priority of the action */
  priority: "immediate" | "soon" | "deferred";
  
  /** Whether this is required */
  required: boolean;
}

export interface OutageWindow {
  /** Provider experiencing the outage */
  providerId: string;
  
  /** Outage start time */
  startTime: string;
  
  /** Outage end time (if known) */
  endTime?: string;
  
  /** Outage is ongoing */
  ongoing: boolean;
  
  /** Reason for outage */
  reason: GapReason;
  
  /** Detected gaps during this outage */
  gaps: CallbackGap[];
}

/**
 * Detect callback gaps based on expected and received events
 */
export function detectCallbackGaps(params: {
  providerId: string;
  eventType: string;
  expectedSequenceRange: { min: number; max: number };
  receivedSequences: number[];
  gapStart: string;
  gapEnd: string;
  reason: GapReason;
}): CallbackGap {
  const { providerId, eventType, expectedSequenceRange, receivedSequences, gapStart, gapEnd, reason } = params;
  
  // Find missing sequence numbers
  const missingSequences: number[] = [];
  for (let seq = expectedSequenceRange.min; seq <= expectedSequenceRange.max; seq++) {
    if (!receivedSequences.includes(seq)) {
      missingSequences.push(seq);
    }
  }
  
  return {
    id: `gap_${providerId}_${eventType}_${Date.now()}`,
    providerId,
    eventType,
    gapStart,
    gapEnd,
    reason,
    estimatedMissedCount: missingSequences.length,
    reconciled: false,
    replayedEvents: [],
    unresolvedEvents: []
  };
}

/**
 * Detect gaps based on time windows when no callbacks were received
 */
export function detectTimeBasedGaps(params: {
  providerId: string;
  eventType: string;
  expectedFrequencyMinutes: number;
  gapStart: string;
  gapEnd: string;
  reason: GapReason;
  receivedEvents: CallbackEvent[];
}): CallbackGap {
  const { providerId, eventType, expectedFrequencyMinutes, gapStart, gapEnd, reason, receivedEvents } = params;
  
  // Calculate expected number of events in the window
  const startTime = new Date(gapStart).getTime();
  const endTime = new Date(gapEnd).getTime();
  const windowDurationMinutes = (endTime - startTime) / (1000 * 60);
  const expectedCount = Math.floor(windowDurationMinutes / expectedFrequencyMinutes);
  
  // Count events in the window
  const eventsInWindow = receivedEvents.filter(e => {
    if (!e.deliveredAt) return false;
    const eventTime = new Date(e.deliveredAt).getTime();
    return eventTime >= startTime && eventTime <= endTime;
  });
  
  const missedCount = Math.max(0, expectedCount - eventsInWindow.length);
  
  return {
    id: `gap_${providerId}_${eventType}_${Date.now()}`,
    providerId,
    eventType,
    gapStart,
    gapEnd,
    reason,
    estimatedMissedCount: missedCount,
    reconciled: false,
    replayedEvents: [],
    unresolvedEvents: []
  };
}

/**
 * Create a reconciliation result from detected gaps
 */
export function createReconciliationResult(params: {
  providerId: string;
  detectedGaps: CallbackGap[];
  status: ReconciliationStatus;
}): ReconciliationResult {
  const { providerId, detectedGaps, status } = params;
  
  let totalReplayed = 0;
  let totalUnresolved = 0;
  const warnings: string[] = [];
  const errors: string[] = [];
  const recommendedActions: ReconciliationAction[] = [];
  
  for (const gap of detectedGaps) {
    totalReplayed += gap.replayedEvents.length;
    totalUnresolved += gap.unresolvedEvents.length;
    
    if (gap.unresolvedEvents.length > 0) {
      warnings.push(
        `${gap.unresolvedEvents.length} event(s) for ${gap.eventType} could not be resolved during gap window ${gap.gapStart} to ${gap.gapEnd}`
      );
    }
  }
  
  const stateConsistent = status === "replayed" || 
                          (status === "partial" && totalUnresolved === 0) ||
                          status === "no_gaps_found";
  
  // Generate summary
  let summary: string;
  switch (status) {
    case "no_gaps_found":
      summary = "No callback gaps detected. System is operating normally.";
      break;
    case "replayed":
      summary = `Successfully replayed ${totalReplayed} missed callback event(s). State is consistent.`;
      break;
    case "partial":
      summary = `Reconciliation complete with ${totalUnresolved} unresolved event(s). Manual review may be required.`;
      recommendedActions.push({
        id: "review_unresolved",
        type: "manual_review",
        description: "Review unresolved events and determine appropriate handling",
        priority: "soon",
        required: true
      });
      break;
    case "failed":
      summary = "Reconciliation failed. Provider state may be inconsistent.";
      errors.push("Reconciliation process encountered an error and could not complete.");
      recommendedActions.push({
        id: "escalate",
        type: "escalate",
        description: "Escalate to engineering for manual intervention",
        priority: "immediate",
        required: true
      });
      break;
    case "detecting_gaps":
    case "reconciling":
      summary = "Reconciliation in progress...";
      break;
    default:
      summary = "Unknown reconciliation status.";
  }
  
  // Add monitoring action if there were any gaps
  if (detectedGaps.length > 0 && status !== "no_gaps_found") {
    recommendedActions.push({
      id: "monitor",
      type: "monitor",
      description: "Monitor provider for 24 hours to ensure stability",
      priority: "soon",
      required: false
    });
  }
  
  return {
    id: `reconcile_${providerId}_${Date.now()}`,
    providerId,
    status,
    startedAt: new Date().toISOString(),
    completedAt: status !== "detecting_gaps" && status !== "reconciling" 
      ? new Date().toISOString() 
      : undefined,
    detectedGaps,
    totalReplayed,
    totalUnresolved,
    stateConsistent,
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
    recommendedActions,
    summary
  };
}

/**
 * Format reconciliation result for operator display
 */
export function formatReconciliationForOperator(result: ReconciliationResult): string {
  const lines = [
    "╔═══════════════════════════════════════════════════════════════╗",
    `║  CALLBACK RECONCILIATION REPORT: ${result.providerId.toUpperCase().padEnd(22)}║`,
    "╠═══════════════════════════════════════════════════════════════╣",
    `║ Status:        ${result.status.replace(/_/g, " ").toUpperCase().padEnd(44)}║`,
    `║ Started:       ${result.startedAt.padEnd(44)}║`,
    result.completedAt 
      ? `║ Completed:     ${result.completedAt.padEnd(44)}║`
      : "║ Completed:     IN PROGRESS".padEnd(50) + "║",
    `║ Gaps Found:    ${result.detectedGaps.length} gap(s)${"".padEnd(30)}║`,
    `║ Events Replayed: ${result.totalReplayed} event(s)${"".padEnd(29)}║`,
    `║ Events Unresolved: ${result.totalUnresolved} event(s)${"".padEnd(26)}║`,
    `║ State Consistent: ${(result.stateConsistent ? "✓ YES" : "✗ NO").padEnd(43)}║`,
  ];
  
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  lines.push("║  SUMMARY                                                        ║");
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  
  const summaryLines = result.summary.split("\n");
  for (const line of summaryLines) {
    lines.push(`║ ${truncate(line, 60).padEnd(62)}║`);
  }
  
  if (result.detectedGaps.length > 0) {
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    lines.push("║  DETECTED GAPS                                                  ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    
    for (const gap of result.detectedGaps) {
      const reconciled = gap.reconciled ? "✓" : "✗";
      lines.push(`║ ${reconciled} [${gap.eventType}]`.padEnd(62) + "║");
      lines.push(`║   Window: ${gap.gapStart} → ${gap.gapEnd}`.padEnd(62) + "║");
      lines.push(`║   Reason: ${gap.reason}, Est. missed: ${gap.estimatedMissedCount}`.padEnd(62) + "║");
      if (gap.replayedEvents.length > 0) {
        lines.push(`║   Replayed: ${gap.replayedEvents.length}, Unresolved: ${gap.unresolvedEvents.length}`.padEnd(62) + "║");
      }
    }
  }
  
  if (result.warnings && result.warnings.length > 0) {
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    lines.push("║  WARNINGS                                                       ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    
    for (const warning of result.warnings) {
      lines.push(`║ ⚠ ${truncate(warning, 58).padEnd(60)}║`);
    }
  }
  
  if (result.errors && result.errors.length > 0) {
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    lines.push("║  ERRORS                                                         ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    
    for (const error of result.errors) {
      lines.push(`║ ✗ ${truncate(error, 58).padEnd(60)}║`);
    }
  }
  
  if (result.recommendedActions.length > 0) {
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    lines.push("║  RECOMMENDED ACTIONS                                            ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    
    for (const action of result.recommendedActions) {
      const marker = action.required ? "[REQ]" : "[OPT]";
      const priority = action.priority.toUpperCase();
      lines.push(`║ ${marker} [${priority}] ${truncate(action.description, 44).padEnd(48)}║`);
    }
  }
  
  lines.push("╚═══════════════════════════════════════════════════════════════╝");
  
  return lines.join("\n");
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

/**
 * Simulate reconciliation for testing
 */
export function simulateReconciliation(params: {
  providerId: string;
  gaps: Array<{
    eventType: string;
    gapStart: string;
    gapEnd: string;
    reason: GapReason;
    replaySuccessRate: number;
    estimatedMissedCount?: number;
  }>;
}): ReconciliationResult {
  const { providerId, gaps } = params;
  
  const detectedGaps: CallbackGap[] = gaps.map(gapParams => {
    const estimatedMissed = gapParams.estimatedMissedCount ?? 5;
    const replayCount = Math.floor(
      gapParams.replaySuccessRate * estimatedMissed
    );
    const unresolvedCount = Math.max(0, estimatedMissed - replayCount);
    
    const gap: CallbackGap = {
      id: `gap_${providerId}_${gapParams.eventType}_${Date.now()}`,
      providerId,
      eventType: gapParams.eventType,
      gapStart: gapParams.gapStart,
      gapEnd: gapParams.gapEnd,
      reason: gapParams.reason,
      estimatedMissedCount: estimatedMissed,
      reconciled: unresolvedCount === 0,
      replayedEvents: Array.from({ length: replayCount }, (_, i) => ({
        id: `replayed_${gapParams.eventType}_${i}`,
        providerId,
        eventType: gapParams.eventType,
        deliveredAt: new Date().toISOString(),
        processed: true,
        processingResult: "success" as const,
        source: "polling" as const
      })),
      unresolvedEvents: Array.from({ length: unresolvedCount }, (_, i) => ({
        id: `unresolved_${gapParams.eventType}_${i}`,
        providerId,
        eventType: gapParams.eventType,
        processed: false,
        processingResult: "failed" as const,
        errorMessage: "Event no longer available for replay",
        source: "polling" as const
      }))
    };
    
    return gap;
  });
  
  const totalReplayed = detectedGaps.reduce((sum, g) => sum + g.replayedEvents.length, 0);
  const totalUnresolved = detectedGaps.reduce((sum, g) => sum + g.unresolvedEvents.length, 0);
  
  let status: ReconciliationStatus;
  if (totalUnresolved === 0 && totalReplayed > 0) {
    status = "replayed";
  } else if (totalUnresolved > 0) {
    status = "partial";
  } else if (totalReplayed === 0 && totalUnresolved === 0) {
    status = "no_gaps_found";
  } else {
    status = "failed";
  }
  
  return createReconciliationResult({
    providerId,
    detectedGaps,
    status
  });
}

export default {
  detectCallbackGaps,
  detectTimeBasedGaps,
  createReconciliationResult,
  formatReconciliationForOperator,
  simulateReconciliation
};
