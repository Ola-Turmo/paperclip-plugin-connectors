/**
 * Rate Limit Visibility
 * 
 * Classifies provider throttling conditions, exposes retry timing and degradation
 * impact, and presents failures as classified errors rather than opaque generic errors.
 * 
 * This module implements UOS-FOUND-CONN-006: Connector throttling is surfaced with 
 * retry timing and impact.
 */

export type RateLimitSeverity = "critical" | "high" | "medium" | "low";

export type BackoffStrategy = "fixed" | "linear" | "exponential" | "decorrelated_jitter";

export interface RateLimitClassification {
  /** Unique classification identifier */
  id: string;
  
  /** Provider experiencing rate limiting */
  providerId: string;
  
  /** Whether this is a rate limit or throttling */
  limitType: "rate_limit" | "quota_exceeded" | "throttle";
  
  /** Severity of the throttling */
  severity: RateLimitSeverity;
  
  /** Current usage if available */
  usage?: {
    used: number;
    limit: number;
    remaining: number;
    resetAt?: string;
    resetInSeconds?: number;
  };
  
  /** Retry timing information */
  retryTiming: {
    /** Recommended delay before retry in milliseconds */
    recommendedDelayMs: number;
    
    /** Calculated delay using backoff strategy */
    calculatedDelayMs: number;
    
    /** Backoff strategy to use */
    strategy: BackoffStrategy;
    
    /** Whether delay is a estimate */
    isEstimate: boolean;
    
    /** Server-suggested retry time if available */
    serverSuggestedRetryMs?: number;
    
    /** When the rate limit will reset */
    resetAt?: string;
    
    /** Seconds until reset */
    secondsUntilReset?: number;
  };
  
  /** Degradation impact assessment */
  impact: {
    /** What operations are affected */
    affectedOperations: string[];
    
    /** Overall degradation level */
    degradationLevel: "none" | "partial" | "significant" | "complete";
    
    /** Whether fallback is available */
    fallbackAvailable: boolean;
    
    /** Whether queued requests are honored */
    queuedRequestsHonored: boolean;
    
    /** Estimated recovery time */
    estimatedRecoveryMinutes?: number;
    
    /** User-facing impact description */
    impactDescription: string;
  };
  
  /** Retry metadata */
  metadata: {
    /** Attempt number (for exponential backoff) */
    attemptNumber: number;
    
    /** Maximum retry attempts allowed */
    maxRetries: number;
    
    /** Whether retry is recommended */
    retryRecommended: boolean;
    
    /** Reason for the recommendation */
    retryReason?: string;
  };
  
  /** When the rate limit was detected */
  detectedAt: string;
  
  /** Retry-After header value if present */
  retryAfterHeader?: string;
  
  /** Display message for operators */
  displayMessage: string;
}

/**
 * Map of severity levels to numeric values for comparison
 */
const SEVERITY_VALUES: Record<RateLimitSeverity, number> = {
  "critical": 4,
  "high": 3,
  "medium": 2,
  "low": 1
};

/**
 * Determine severity based on remaining quota percentage
 */
function determineSeverity(remaining: number, limit: number): RateLimitSeverity {
  const ratio = remaining / limit;
  if (ratio <= 0) return "critical";
  if (ratio <= 0.1) return "high";
  if (ratio <= 0.3) return "medium";
  return "low";
}

/**
 * Calculate backoff delay using the specified strategy
 */
export function calculateBackoffDelay(params: {
  strategy: BackoffStrategy;
  attemptNumber: number;
  baseDelayMs: number;
  maxDelayMs: number;
  lastDelayMs?: number;
  serverSuggestedMs?: number;
}): number {
  const { strategy, attemptNumber, baseDelayMs, maxDelayMs, lastDelayMs = baseDelayMs, serverSuggestedMs } = params;
  
  // If server suggested a delay, use that with some tolerance
  if (serverSuggestedMs && serverSuggestedMs > 0) {
    // Add small jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * serverSuggestedMs;
    return Math.min(serverSuggestedMs + jitter, maxDelayMs);
  }
  
  let delay: number;
  
  switch (strategy) {
    case "fixed":
      delay = baseDelayMs;
      break;
      
    case "linear":
      delay = baseDelayMs * attemptNumber;
      break;
      
    case "exponential":
      delay = Math.min(baseDelayMs * Math.pow(2, attemptNumber - 1), maxDelayMs);
      break;
      
    case "decorrelated_jitter":
      // Decorrelated jitter from AWS architecture blog
      delay = Math.min(
        Math.random() * 3 * lastDelayMs,
        maxDelayMs
      );
      break;
      
    default:
      delay = baseDelayMs;
  }
  
  return Math.min(delay, maxDelayMs);
}

/**
 * Estimate recovery time based on rate limit characteristics
 */
export function estimateRecoveryTime(params: {
  remaining: number;
  limit: number;
  windowSeconds: number;
  requestsPerMinute?: number;
}): number | undefined {
  const { remaining, limit, windowSeconds, requestsPerMinute } = params;
  
  if (remaining > 0) {
    // If we have remaining quota, estimate based on normal request rate
    if (requestsPerMinute) {
      return Math.ceil(remaining / requestsPerMinute);
    }
    // Otherwise estimate based on the window
    return Math.ceil((remaining / limit) * windowSeconds / 60);
  }
  
  // No remaining quota, estimate based on window reset
  return Math.ceil(windowSeconds / 60);
}

/**
 * Classify a rate limit/throttle condition
 */
export function classifyRateLimit(params: {
  providerId: string;
  headers?: Record<string, string>;
  statusCode?: number;
  errorMessage?: string;
  retryPolicy?: {
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    maxRetries: number;
    strategy?: BackoffStrategy;
  };
  attemptNumber?: number;
}): RateLimitClassification {
  const {
    providerId,
    headers = {},
    statusCode,
    errorMessage = "",
    retryPolicy,
    attemptNumber = 1
  } = params;
  
  // Parse rate limit headers (common patterns)
  const remaining = headers["x-rate-limit-remaining"] 
    ? parseInt(headers["x-rate-limit-remaining"], 10) 
    : headers["X-RateLimit-Remaining"] 
      ? parseInt(headers["X-RateLimit-Remaining"], 10)
      : undefined;
      
  const limit = headers["x-rate-limit-limit"]
    ? parseInt(headers["x-rate-limit-limit"], 10)
    : headers["X-RateLimit-Limit"]
      ? parseInt(headers["X-RateLimit-Limit"], 10)
      : undefined;
      
  const resetAt = headers["x-rate-limit-reset"]
    ? new Date(parseInt(headers["x-rate-limit-reset"], 10) * 1000).toISOString()
    : headers["X-RateLimit-Reset"]
      ? new Date(parseInt(headers["X-RateLimit-Reset"], 10) * 1000).toISOString()
      : undefined;
      
  const resetInSeconds = headers["retry-after"]
    ? parseInt(headers["retry-after"], 10)
    : headers["Retry-After"]
      ? parseInt(headers["Retry-After"], 10)
      : undefined;
      
  const retryAfterHeader = headers["retry-after"] || headers["Retry-After"];
  
  // Determine limit type
  let limitType: RateLimitClassification["limitType"] = "rate_limit";
  if (errorMessage.includes("quota") || errorMessage.includes("Quota")) {
    limitType = "quota_exceeded";
  } else if (errorMessage.includes("throttle") || errorMessage.includes("Throttle")) {
    limitType = "throttle";
  }
  
  // Calculate severity
  let severity: RateLimitSeverity;
  if (remaining !== undefined && limit !== undefined) {
    severity = determineSeverity(remaining, limit);
  } else if (statusCode === 429) {
    severity = "medium"; // Default for 429 without header info
    if (errorMessage.includes("second") || errorMessage.includes("minute")) {
      severity = "high"; // Likely very restrictive
    }
  } else {
    severity = "low";
  }
  
  // Determine backoff strategy
  const strategy = retryPolicy?.strategy ?? "exponential";
  
  // Calculate recommended delay
  const baseDelay = retryPolicy?.initialDelayMs ?? 1000;
  const maxDelay = retryPolicy?.maxDelayMs ?? 30000;
  const serverSuggestedMs = resetInSeconds ? resetInSeconds * 1000 : undefined;
  
  const calculatedDelayMs = calculateBackoffDelay({
    strategy,
    attemptNumber,
    baseDelayMs: baseDelay,
    maxDelayMs: maxDelay,
    serverSuggestedMs
  });
  
  // Use server suggestion if available and reasonable
  const recommendedDelayMs = serverSuggestedMs 
    ? Math.min(serverSuggestedMs, maxDelay)
    : calculatedDelayMs;
  
  // Determine degradation level
  let degradationLevel: RateLimitClassification["impact"]["degradationLevel"];
  if (remaining !== undefined && limit !== undefined) {
    const ratio = remaining / limit;
    if (ratio > 0.5) {
      degradationLevel = "none";
    } else if (ratio > 0.2) {
      degradationLevel = "partial";
    } else if (ratio > 0) {
      degradationLevel = "significant";
    } else {
      degradationLevel = "complete";
    }
  } else if (severity === "critical" || severity === "high") {
    degradationLevel = "significant";
  } else {
    degradationLevel = "partial";
  }
  
  // Determine affected operations
  const affectedOperations: string[] = [];
  if (degradationLevel === "complete") {
    affectedOperations.push("All API operations");
  } else if (degradationLevel === "significant") {
    affectedOperations.push("Write operations", "Non-critical read operations");
  } else if (degradationLevel === "partial") {
    affectedOperations.push("Batch operations", "Bulk requests");
  } else {
    affectedOperations.push("No operations affected");
  }
  
  // Calculate estimated recovery
  const estimatedRecoveryMinutes = remaining !== undefined && limit !== undefined
    ? estimateRecoveryTime({ 
        remaining, 
        limit, 
        windowSeconds: 60, // Assuming per-minute limits
        requestsPerMinute: limit
      })
    : undefined;
  
  // Determine if retry is recommended
  const maxRetries = retryPolicy?.maxRetries ?? 5;
  const retryRecommended = attemptNumber < maxRetries;
  const retryReason = !retryRecommended
    ? `Maximum retry attempts (${maxRetries}) reached`
    : attemptNumber === 1
      ? "Transient throttling, likely to succeed on retry"
      : `Retry attempt ${attemptNumber} of ${maxRetries}`;
  
  // Generate display message
  let displayMessage: string;
  if (remaining !== undefined && limit !== undefined) {
    displayMessage = `Rate limit: ${remaining}/${limit} requests remaining. ` +
      `Recommended retry in ${formatDelay(recommendedDelayMs)}.`;
  } else if (resetInSeconds) {
    displayMessage = `Rate limited. Retry after ${resetInSeconds} seconds.`;
  } else {
    displayMessage = `Rate limit exceeded. Recommended backoff: ${formatDelay(recommendedDelayMs)}.`;
  }
  
  return {
    id: `ratelimit_${providerId}_${Date.now()}`,
    providerId,
    limitType,
    severity,
    usage: remaining !== undefined && limit !== undefined
      ? {
          used: limit - remaining,
          limit,
          remaining,
          resetAt,
          resetInSeconds
        }
      : undefined,
    retryTiming: {
      recommendedDelayMs,
      calculatedDelayMs,
      strategy,
      isEstimate: !serverSuggestedMs,
      serverSuggestedRetryMs: serverSuggestedMs,
      resetAt,
      secondsUntilReset: resetInSeconds
    },
    impact: {
      affectedOperations,
      degradationLevel,
      fallbackAvailable: degradationLevel !== "complete",
      queuedRequestsHonored: degradationLevel !== "complete",
      estimatedRecoveryMinutes,
      impactDescription: generateImpactDescription(degradationLevel, affectedOperations)
    },
    metadata: {
      attemptNumber,
      maxRetries,
      retryRecommended,
      retryReason
    },
    detectedAt: new Date().toISOString(),
    retryAfterHeader,
    displayMessage
  };
}

/**
 * Generate human-readable impact description
 */
function generateImpactDescription(
  level: RateLimitClassification["impact"]["degradationLevel"],
  affectedOperations: string[]
): string {
  switch (level) {
    case "none":
      return "No operational impact. Rate limit has headroom.";
    case "partial":
      return `Minor impact: ${affectedOperations.join(", ").toLowerCase()} may be delayed.`;
    case "significant":
      return `Moderate impact: Most ${affectedOperations.join(", ").toLowerCase().toLowerCase()} are affected. Consider using fallback.`;
    case "complete":
      return `Severe impact: All operations are blocked. Use fallback or wait for rate limit reset.`;
    default:
      return "Impact unknown.";
  }
}

/**
 * Format delay for display
 */
function formatDelay(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format rate limit classification for operator display
 */
export function formatRateLimitForOperator(classification: RateLimitClassification): string {
  const lines = [
    "╔═══════════════════════════════════════════════════════════════╗",
    "║  RATE LIMIT / THROTTLING DETECTED                             ║",
    "╠═══════════════════════════════════════════════════════════════╣",
    `║ Provider:     ${classification.providerId.padEnd(44)}║`,
    `║ Limit Type:   ${classification.limitType.replace(/_/g, " ").toUpperCase().padEnd(44)}║`,
    `║ Severity:    ${classification.severity.toUpperCase().padEnd(44)}║`,
    `║ Detected:     ${classification.detectedAt.padEnd(44)}║`,
  ];
  
  if (classification.usage) {
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    lines.push("║  USAGE                                                          ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    lines.push(`║ Remaining:    ${classification.usage.remaining} of ${classification.usage.limit}`.padEnd(62) + "║");
    if (classification.usage.resetAt) {
      lines.push(`║ Resets at:   ${classification.usage.resetAt.padEnd(44)}║`);
    }
    if (classification.usage.resetInSeconds) {
      lines.push(`║ Resets in:   ${classification.usage.resetInSeconds} seconds`.padEnd(62) + "║");
    }
  }
  
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  lines.push("║  RETRY TIMING                                                    ║");
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  lines.push(`║ Strategy:     ${classification.retryTiming.strategy.replace(/_/g, " ").toUpperCase().padEnd(44)}║`);
  lines.push(`║ Recommended:  ${formatDelay(classification.retryTiming.recommendedDelayMs).padEnd(44)}║`);
  lines.push(`║ Calculated:  ${formatDelay(classification.retryTiming.calculatedDelayMs).padEnd(44)}║`);
  lines.push(`║ Is Estimate:  ${(classification.retryTiming.isEstimate ? "YES" : "NO").padEnd(44)}║`);
  if (classification.retryTiming.serverSuggestedRetryMs) {
    lines.push(`║ Server Says:  ${formatDelay(classification.retryTiming.serverSuggestedRetryMs).padEnd(44)}║`);
  }
  
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  lines.push("║  IMPACT                                                          ║");
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  lines.push(`║ Level:        ${classification.impact.degradationLevel.toUpperCase().padEnd(44)}║`);
  lines.push(`║ Fallback:     ${(classification.impact.fallbackAvailable ? "AVAILABLE" : "NOT AVAILABLE").padEnd(44)}║`);
  for (const op of classification.impact.affectedOperations.slice(0, 3)) {
    lines.push(`║ Affected:     ${truncate(op, 40).padEnd(42)}║`);
  }
  if (classification.impact.estimatedRecoveryMinutes) {
    lines.push(`║ Est. Recovery: ${classification.impact.estimatedRecoveryMinutes} minute(s)`.padEnd(61) + "║");
  }
  lines.push(`║ ${truncate(classification.impact.impactDescription, 60).padEnd(62)}║`);
  
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  lines.push("║  RETRY STATUS                                                    ║");
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  lines.push(`║ Attempt:      ${classification.metadata.attemptNumber} of ${classification.metadata.maxRetries}`.padEnd(62) + "║");
  lines.push(`║ Recommended: ${(classification.metadata.retryRecommended ? "YES" : "NO").padEnd(44)}║`);
  if (classification.metadata.retryReason) {
    lines.push(`║ Reason:      ${truncate(classification.metadata.retryReason, 40).padEnd(42)}║`);
  }
  
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  lines.push("║  DISPLAY MESSAGE                                                 ║");
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  lines.push(`║ ${truncate(classification.displayMessage, 60).padEnd(62)}║`);
  lines.push("╚═══════════════════════════════════════════════════════════════╝");
  
  return lines.join("\n");
}

/**
 * Compare two rate limit severities
 */
export function compareSeverity(a: RateLimitSeverity, b: RateLimitSeverity): number {
  return SEVERITY_VALUES[a] - SEVERITY_VALUES[b];
}

/**
 * Determine if a more severe rate limit should replace a less severe one
 */
export function shouldReplaceRateLimit(
  existing: RateLimitClassification,
  incoming: RateLimitClassification
): boolean {
  return compareSeverity(incoming.severity, existing.severity) > 0;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

export default {
  calculateBackoffDelay,
  estimateRecoveryTime,
  classifyRateLimit,
  formatRateLimitForOperator,
  compareSeverity,
  shouldReplaceRateLimit
};
