/**
 * Connector Failure Classification
 * 
 * Classifies auth failures, callback mismatches, and other connector errors into
 * operator-visible states with enough evidence to distinguish failure types and
 * guide recovery.
 * 
 * This module implements UOS-FOUND-CONN-002: Auth and callback failures are surfaced 
 * as diagnosable states.
 */

export type FailureCategory =
  | "auth_failure"           // Authentication problems
  | "auth_expired"           // Token expired
  | "auth_revoked"           // Token/scope revoked
  | "auth_insufficient"      // Insufficient permissions/scopes
  | "callback_mismatch"      // Webhook/callback verification failed
  | "callback_missing"       // Expected callback not received
  | "callback_duplicate"     // Duplicate callback received
  | "rate_limit"            // Provider throttling
  | "retry_needed"          // Transient failure, retry might help
  | "resource_not_found"    // Resource doesn't exist or is inaccessible
  | "resource_conflict"      // Resource conflict (e.g., duplicate)
  | "provider_unavailable"   // Provider API is down
  | "network_error"         // Network connectivity issue
  | "schema_drift"          // Provider changed expected schema
  | "unknown";              // Unclassified failure

export type FailureSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface FailureClassification {
  /** Unique classification identifier */
  id: string;
  
  /** Failure category */
  category: FailureCategory;
  
  /** Severity level */
  severity: FailureSeverity;
  
  /** Human-readable title */
  title: string;
  
  /** Detailed description */
  description: string;
  
  /** Provider that generated the error */
  providerId: string;
  
  /** Whether retry might succeed */
  retryable: boolean;
  
  /** Recommended retry delay in milliseconds */
  suggestedRetryDelayMs?: number;
  
  /** Maximum retry attempts recommended */
  maxRetries?: number;
  
  /** Recovery actions available */
  recoveryActions: RecoveryAction[];
  
  /** Evidence attached to this failure */
  evidence: FailureEvidence[];
  
  /** Timestamp when failure was detected */
  detectedAt: string;
  
  /** Whether this failure has been acknowledged */
  acknowledged: boolean;
  
  /** Original error message (may contain sensitive data) */
  originalError?: string;
  
  /** Sanitized error for display */
  displayMessage: string;
}

export interface RecoveryAction {
  /** Action identifier */
  id: string;
  
  /** Action type */
  type: "reconnect" | "refresh_token" | "revoke_reconnect" | "retry" | "skip" | "ignore" | "escalate" | "manual_review" | "fallback";
  
  /** Human-readable description */
  description: string;
  
  /** Whether this action requires user intervention */
  requiresUserAction: boolean;
  
  /** Estimated effort to complete */
  estimatedEffort?: "minutes" | "hours" | "days";
  
  /** Priority for this action */
  priority: "immediate" | "soon" | "deferred";
}

export interface FailureEvidence {
  /** Evidence type */
  type: "error_response" | "status_code" | "headers" | "request_id" | "timestamp" | "callback_payload" | "token_info" | "schema_sample";
  
  /** Evidence key/name */
  key: string;
  
  /** Evidence value */
  value: string;
  
  /** Whether this evidence contains sensitive data */
  containsSensitiveData: boolean;
}

/**
 * Map of status codes to failure categories
 */
const STATUS_CODE_CATEGORIES: Record<number, FailureCategory> = {
  400: "retry_needed",
  401: "auth_failure",
  403: "auth_insufficient",
  404: "resource_not_found",
  409: "resource_conflict",
  429: "rate_limit",
  500: "retry_needed",
  502: "provider_unavailable",
  503: "provider_unavailable",
  504: "network_error"
};

/**
 * Map of error messages to failure categories (partial match)
 */
const ERROR_MESSAGE_PATTERNS: Array<{ pattern: RegExp; category: FailureCategory; severity: FailureSeverity }> = [
  { pattern: /token.*expired/i, category: "auth_expired", severity: "high" },
  { pattern: /token.*revoked/i, category: "auth_revoked", severity: "high" },
  { pattern: /access_token.*invalid/i, category: "auth_failure", severity: "high" },
  { pattern: /invalid.*signature/i, category: "callback_mismatch", severity: "high" },
  { pattern: /webhook.*verification.*failed/i, category: "callback_mismatch", severity: "high" },
  { pattern: /signature.*mismatch/i, category: "callback_mismatch", severity: "high" },
  { pattern: /rate.?limit/i, category: "rate_limit", severity: "medium" },
  { pattern: /too.?many.?requests/i, category: "rate_limit", severity: "medium" },
  { pattern: /quota.?exceeded/i, category: "rate_limit", severity: "medium" },
  { pattern: /retry.?after/i, category: "retry_needed", severity: "low" },
  { pattern: /timeout/i, category: "network_error", severity: "medium" },
  { pattern: /connection.*refused/i, category: "network_error", severity: "medium" },
  { pattern: /econnreset/i, category: "network_error", severity: "medium" },
  { pattern: /enotfound/i, category: "network_error", severity: "medium" },
  { pattern: /schema.*changed/i, category: "schema_drift", severity: "high" },
  { pattern: /unexpected.*response/i, category: "schema_drift", severity: "medium" },
  { pattern: /insufficient.*scope/i, category: "auth_insufficient", severity: "high" },
  { pattern: /permission.*denied/i, category: "auth_insufficient", severity: "high" },
  { pattern: /unauthorized/i, category: "auth_failure", severity: "high" },
  { pattern: /forbidden/i, category: "auth_insufficient", severity: "high" },
  { pattern: /not.?found/i, category: "resource_not_found", severity: "medium" },
  { pattern: /already.*exists/i, category: "resource_conflict", severity: "medium" },
  { pattern: /duplicate/i, category: "callback_duplicate", severity: "low" },
  { pattern: /provider.*unavailable/i, category: "provider_unavailable", severity: "high" },
  { pattern: /service.*unavailable/i, category: "provider_unavailable", severity: "high" },
  { pattern: /internal.*error/i, category: "retry_needed", severity: "low" },
];

/**
 * Get severity for a failure category
 */
function getSeverityForCategory(category: FailureCategory): FailureSeverity {
  const severities: Record<FailureCategory, FailureSeverity> = {
    "auth_revoked": "critical",
    "auth_failure": "high",
    "auth_expired": "high",
    "auth_insufficient": "high",
    "callback_mismatch": "high",
    "provider_unavailable": "high",
    "rate_limit": "medium",
    "schema_drift": "high",
    "resource_not_found": "medium",
    "resource_conflict": "medium",
    "retry_needed": "low",
    "network_error": "medium",
    "callback_missing": "medium",
    "callback_duplicate": "low",
    "unknown": "low"
  };
  return severities[category];
}

/**
 * Get suggested retry delay for a failure category
 */
function getSuggestedRetryDelay(category: FailureCategory, providerRetryPolicy?: {
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}): number | undefined {
  if (category === "rate_limit") {
    return providerRetryPolicy?.initialDelayMs ?? 60000; // 1 minute default for rate limits
  }
  if (category === "retry_needed" || category === "network_error" || category === "provider_unavailable") {
    return providerRetryPolicy?.initialDelayMs ?? 5000; // 5 seconds default
  }
  if (category === "auth_expired") {
    return 0; // No retry, need token refresh
  }
  return undefined;
}

/**
 * Generate recovery actions for a failure category
 */
function generateRecoveryActions(
  category: FailureCategory, 
  providerId: string
): RecoveryAction[] {
  const actions: RecoveryAction[] = [];
  
  switch (category) {
    case "auth_failure":
    case "auth_expired":
    case "auth_revoked":
      actions.push({
        id: "reconnect",
        type: "reconnect",
        description: "Reconnect to refresh authentication credentials",
        requiresUserAction: true,
        estimatedEffort: "minutes",
        priority: "immediate"
      });
      if (category === "auth_expired") {
        actions.push({
          id: "refresh_token",
          type: "refresh_token",
          description: "Attempt automatic token refresh",
          requiresUserAction: false,
          priority: "immediate"
        });
      }
      break;
      
    case "auth_insufficient":
      actions.push({
        id: "reconnect_with_scopes",
        type: "reconnect",
        description: "Reconnect with additional required scopes",
        requiresUserAction: true,
        estimatedEffort: "minutes",
        priority: "immediate"
      });
      actions.push({
        id: "escalate",
        type: "escalate",
        description: "Escalate to administrator for appropriate permissions",
        requiresUserAction: true,
        estimatedEffort: "hours",
        priority: "soon"
      });
      break;
      
    case "callback_mismatch":
      actions.push({
        id: "verify_webhook_config",
        type: "manual_review",
        description: "Verify webhook configuration and secret",
        requiresUserAction: true,
        estimatedEffort: "minutes",
        priority: "immediate"
      });
      actions.push({
        id: "retry",
        type: "retry",
        description: "Retry the callback delivery",
        requiresUserAction: false,
        priority: "immediate"
      });
      break;
      
    case "callback_missing":
      actions.push({
        id: "trigger_reconciliation",
        type: "manual_review",
        description: "Trigger callback reconciliation to detect gaps",
        requiresUserAction: true,
        estimatedEffort: "minutes",
        priority: "soon"
      });
      break;
      
    case "callback_duplicate":
      actions.push({
        id: "skip",
        type: "skip",
        description: "Acknowledge duplicate and skip processing",
        requiresUserAction: false,
        priority: "immediate"
      });
      break;
      
    case "rate_limit":
      actions.push({
        id: "retry_after_backoff",
        type: "retry",
        description: "Wait for suggested backoff period before retrying",
        requiresUserAction: false,
        priority: "immediate"
      });
      actions.push({
        id: "use_fallback",
        type: "fallback",
        description: "Use alternative fallback path if available",
        requiresUserAction: false,
        priority: "soon"
      });
      break;
      
    case "retry_needed":
      actions.push({
        id: "retry",
        type: "retry",
        description: "Retry the operation",
        requiresUserAction: false,
        priority: "immediate"
      });
      break;
      
    case "resource_not_found":
      actions.push({
        id: "manual_review",
        type: "manual_review",
        description: "Investigate resource existence and accessibility",
        requiresUserAction: true,
        estimatedEffort: "minutes",
        priority: "soon"
      });
      break;
      
    case "resource_conflict":
      actions.push({
        id: "resolve_conflict",
        type: "manual_review",
        description: "Resolve resource conflict manually",
        requiresUserAction: true,
        estimatedEffort: "minutes",
        priority: "soon"
      });
      break;
      
    case "provider_unavailable":
      actions.push({
        id: "retry_with_backoff",
        type: "retry",
        description: "Retry with exponential backoff",
        requiresUserAction: false,
        priority: "immediate"
      });
      actions.push({
        id: "escalate",
        type: "escalate",
        description: "Escalate if provider remains unavailable",
        requiresUserAction: true,
        estimatedEffort: "hours",
        priority: "deferred"
      });
      break;
      
    case "network_error":
      actions.push({
        id: "retry",
        type: "retry",
        description: "Retry the network request",
        requiresUserAction: false,
        priority: "immediate"
      });
      break;
      
    case "schema_drift":
      actions.push({
        id: "update_schema",
        type: "manual_review",
        description: "Update connector schema mapping to match provider changes",
        requiresUserAction: true,
        estimatedEffort: "hours",
        priority: "immediate"
      });
      break;
      
    default:
      actions.push({
        id: "manual_review",
        type: "manual_review",
        description: "Review failure and determine appropriate action",
        requiresUserAction: true,
        priority: "soon"
      });
  }
  
  // Add generic escalation action if not present
  if (!actions.some(a => a.type === "escalate")) {
    actions.push({
      id: "escalate",
      type: "escalate",
      description: "Escalate to support if issue persists",
      requiresUserAction: true,
      estimatedEffort: "hours",
      priority: "deferred"
    });
  }
  
  return actions;
}

/**
 * Classify a connector failure based on available information
 */
export function classifyFailure(params: {
  providerId: string;
  errorMessage?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  errorResponse?: unknown;
  requestId?: string;
  timestamp?: Date;
  retryPolicy?: {
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}): FailureClassification {
  const {
    providerId,
    errorMessage = "",
    statusCode,
    headers = {},
    errorResponse,
    requestId,
    timestamp = new Date(),
    retryPolicy
  } = params;
  
  // Determine failure category
  let category: FailureCategory = "unknown";
  
  // First check status code
  if (statusCode && STATUS_CODE_CATEGORIES[statusCode]) {
    category = STATUS_CODE_CATEGORIES[statusCode];
  } else {
    // Fall back to error message pattern matching
    for (const { pattern, category: cat } of ERROR_MESSAGE_PATTERNS) {
      if (pattern.test(errorMessage)) {
        category = cat;
        break;
      }
    }
  }
  
  const severity = getSeverityForCategory(category);
  const suggestedRetryDelayMs = getSuggestedRetryDelay(category, retryPolicy);
  
  // Collect evidence
  const evidence: FailureEvidence[] = [];
  
  if (statusCode) {
    evidence.push({
      type: "status_code",
      key: "httpStatusCode",
      value: String(statusCode),
      containsSensitiveData: false
    });
  }
  
  if (requestId) {
    evidence.push({
      type: "request_id",
      key: "requestId",
      value: requestId,
      containsSensitiveData: false
    });
  }
  
  evidence.push({
    type: "timestamp",
    key: "detectedAt",
    value: timestamp.toISOString(),
    containsSensitiveData: false
  });
  
  // Check for rate limit headers
  if (headers["retry-after"] || headers["Retry-After"]) {
    evidence.push({
      type: "headers",
      key: "retryAfter",
      value: headers["retry-after"] || headers["Retry-After"] || "",
      containsSensitiveData: false
    });
  }
  
  if (headers["x-rate-limit-remaining"]) {
    evidence.push({
      type: "headers",
      key: "rateLimitRemaining",
      value: headers["x-rate-limit-remaining"],
      containsSensitiveData: false
    });
  }
  
  if (headers["x-rate-limit-reset"]) {
    evidence.push({
      type: "headers",
      key: "rateLimitReset",
      value: headers["x-ratelimit-reset"],
      containsSensitiveData: false
    });
  }
  
  // Determine if retryable
  const retryableCategories: FailureCategory[] = [
    "retry_needed", "rate_limit", "network_error", 
    "provider_unavailable", "callback_mismatch", "callback_missing"
  ];
  const retryable = retryableCategories.includes(category);
  
  // Calculate max retries based on category
  const maxRetries = category === "rate_limit" ? 5 : 
                     category === "retry_needed" ? 3 : 
                     retryable ? 3 : 0;
  
  // Generate display message (sanitized)
  let displayMessage = generateDisplayMessage(category, errorMessage, statusCode);
  
  return {
    id: `failure_${providerId}_${Date.now()}`,
    category,
    severity,
    title: generateTitle(category),
    description: generateDescription(category),
    providerId,
    retryable,
    suggestedRetryDelayMs,
    maxRetries,
    recoveryActions: generateRecoveryActions(category, providerId),
    evidence,
    detectedAt: timestamp.toISOString(),
    acknowledged: false,
    originalError: errorMessage,
    displayMessage
  };
}

/**
 * Generate a human-readable title for a failure category
 */
function generateTitle(category: FailureCategory): string {
  const titles: Record<FailureCategory, string> = {
    "auth_failure": "Authentication Failed",
    "auth_expired": "Authentication Expired",
    "auth_revoked": "Authentication Revoked",
    "auth_insufficient": "Insufficient Permissions",
    "callback_mismatch": "Callback Verification Failed",
    "callback_missing": "Expected Callback Not Received",
    "callback_duplicate": "Duplicate Callback Detected",
    "rate_limit": "Rate Limit Exceeded",
    "retry_needed": "Transient Error - Retry Possible",
    "resource_not_found": "Resource Not Found",
    "resource_conflict": "Resource Conflict",
    "provider_unavailable": "Provider Service Unavailable",
    "network_error": "Network Error",
    "schema_drift": "Provider Schema Changed",
    "unknown": "Unknown Error"
  };
  return titles[category];
}

/**
 * Generate a detailed description for a failure category
 */
function generateDescription(category: FailureCategory): string {
  const descriptions: Record<FailureCategory, string> = {
    "auth_failure": "The connector failed to authenticate with the provider. This may be due to invalid credentials, a misconfigured auth setup, or an authentication service outage.",
    "auth_expired": "The authentication token has expired. The connector needs to refresh the token or re-authenticate to continue operating.",
    "auth_revoked": "The authentication token or authorized scopes have been revoked by the provider or administrator. The connector must re-authenticate with new credentials.",
    "auth_insufficient": "The authenticated session does not have sufficient permissions to perform the requested operation. Additional scopes or elevated privileges may be required.",
    "callback_mismatch": "Webhook or callback signature verification failed. This could indicate a configuration error, a replay attack, or that the callback is not from the expected source.",
    "callback_missing": "An expected callback or webhook event was not received within the expected timeframe. This may indicate a provider outage, network issue, or configuration problem.",
    "callback_duplicate": "A duplicate callback was received. This may be a retry from the provider or a replay attack. The callback was likely already processed.",
    "rate_limit": "The provider has throttled the connector due to exceeding rate limits. Reduce request frequency and wait for the backoff period before retrying.",
    "retry_needed": "A transient error occurred that may resolve on retry. The operation can be retried without intervention, though manual review may be needed if retries fail.",
    "resource_not_found": "The requested resource does not exist, has been deleted, or is not accessible with the current credentials.",
    "resource_conflict": "The operation conflicts with an existing resource. This may be a duplicate or a state conflict that requires manual resolution.",
    "provider_unavailable": "The provider's service is currently unavailable or experiencing an outage. Retry with backoff until the service recovers.",
    "network_error": "A network connectivity error occurred. Check network configuration and retry once connectivity is restored.",
    "schema_drift": "The provider has changed its API schema or response format. The connector needs to be updated to handle the new schema.",
    "unknown": "An unknown error occurred. Manual investigation is required to determine the cause and appropriate remediation."
  };
  return descriptions[category];
}

/**
 * Generate a sanitized display message for an error
 */
function generateDisplayMessage(
  category: FailureCategory, 
  errorMessage: string, 
  statusCode?: number
): string {
  // Remove any sensitive patterns from error messages
  const sanitized = errorMessage
    .replace(/[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g, "[email]") // emails
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [token]") // tokens
    .replace(/token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/gi, "token: [redacted]")
    .replace(/password["']?\s*[:=]\s*["']?[^\s"']+["']?/gi, "password: [redacted]")
    .replace(/secret["']?\s*[:=]\s*["']?[^\s"']+["']?/gi, "secret: [redacted]")
    .replace(/key["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/gi, "key: [redacted]");
  
  const statusPart = statusCode ? ` [HTTP ${statusCode}]` : "";
  return sanitized.trim() || category.replace(/_/g, " ") + statusPart;
}

/**
 * Check if a failure is retryable
 */
export function isRetryable(failure: FailureClassification): boolean {
  return failure.retryable;
}

/**
 * Check if a failure requires immediate attention
 */
export function requiresImmediateAttention(failure: FailureClassification): boolean {
  return failure.severity === "critical" || 
         failure.severity === "high" ||
         failure.category === "auth_revoked" ||
         failure.category === "auth_expired";
}

/**
 * Get the highest priority recovery action
 */
export function getPrimaryRecoveryAction(
  failure: FailureClassification
): RecoveryAction | undefined {
  const sorted = [...failure.recoveryActions].sort((a, b) => {
    const priorityOrder = { immediate: 0, soon: 1, deferred: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  return sorted[0];
}

/**
 * Format a failure for operator display
 */
export function formatFailureForOperator(failure: FailureClassification): string {
  const lines = [
    `┌─────────────────────────────────────────────────────────┐`,
    `│ FAILURE: ${failure.title.padEnd(48)}│`,
    `├─────────────────────────────────────────────────────────┤`,
    `│ Category:    ${failure.category.padEnd(44)}│`,
    `│ Severity:    ${failure.severity.padEnd(44)}│`,
    `│ Provider:    ${failure.providerId.padEnd(44)}│`,
    `│ Detected:    ${failure.detectedAt.padEnd(44)}│`,
    `├─────────────────────────────────────────────────────────┤`,
    `│ ${"Description".padEnd(48)}│`,
    `│ ${truncate(failure.description, 46).padEnd(48)}│`,
    `├─────────────────────────────────────────────────────────┤`,
    `│ ${"Display Message".padEnd(48)}│`,
    `│ ${truncate(failure.displayMessage, 46).padEnd(48)}│`,
  ];
  
  if (failure.retryable) {
    lines.push(`├─────────────────────────────────────────────────────────┤`);
    lines.push(`│ RETRY: ${failure.retryable ? "YES" : "NO".padEnd(44)}│`);
    if (failure.suggestedRetryDelayMs) {
      lines.push(`│ Retry Delay: ${formatRetryDelay(failure.suggestedRetryDelayMs).padEnd(41)}│`);
    }
    if (failure.maxRetries) {
      lines.push(`│ Max Retries:  ${String(failure.maxRetries).padEnd(44)}│`);
    }
  }
  
  lines.push(`├─────────────────────────────────────────────────────────┤`);
  lines.push(`│ RECOVERY ACTIONS${"".padEnd(36)}│`);
  for (const action of failure.recoveryActions.slice(0, 3)) {
    const icon = action.requiresUserAction ? "👤" : "⚙️";
    lines.push(`│ ${icon} [${action.priority.toUpperCase().padEnd(8)}] ${truncate(action.description, 32).padEnd(34)}│`);
  }
  
  lines.push(`├─────────────────────────────────────────────────────────┤`);
  lines.push(`│ EVIDENCE${"".padEnd(45)}│`);
  for (const ev of failure.evidence.slice(0, 4)) {
    lines.push(`│ ${ev.key.padEnd(14)}: ${truncate(ev.value, 30).padEnd(32)}│`);
  }
  
  lines.push(`└─────────────────────────────────────────────────────────┘`);
  
  return lines.join("\n");
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function formatRetryDelay(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default {
  classifyFailure,
  isRetryable,
  requiresImmediateAttention,
  getPrimaryRecoveryAction,
  formatFailureForOperator
};
