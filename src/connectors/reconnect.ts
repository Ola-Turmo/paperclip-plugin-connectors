/**
 * Connector Reconnect Flow
 * 
 * Handles expired or revoked authentication with preserved workflow context
 * and presents reconnection guidance to operators.
 * 
 * This module implements UOS-FOUND-CONN-004: Expired or revoked auth yields a 
 * reconnect flow with preserved context.
 */

import { classifyFailure, type FailureClassification } from "./failure-classifier.js";

export type ReconnectState =
  | "idle"                    // No reconnection needed
  | "auth_expired_warning"   // Token expiring soon
  | "auth_expired"           // Token has expired
  | "auth_revoked"           // Token/scope has been revoked
  | "reconnecting"           // Reconnection in progress
  | "reconnected"            // Successfully reconnected
  | "reconnect_failed"        // Reconnection failed
  | "reconnect_blocked";     // Reconnection not possible

export interface WorkflowContext {
  /** Workflow identifier */
  workflowId: string;
  
  /** Workflow type/name */
  workflowType: string;
  
  /** Description of the workflow */
  description: string;
  
  /** Current step in the workflow */
  currentStep?: string;
  
  /** Steps completed before failure */
  completedSteps: string[];
  
  /** Pending steps that were not executed */
  pendingSteps: string[];
  
  /** Input parameters to the workflow */
  inputParameters: Record<string, unknown>;
  
  /** Intermediate results captured so far */
  intermediateResults: Record<string, unknown>;
  
  /** Error that caused the workflow to stop */
  failure?: FailureClassification;
  
  /** Timestamp when workflow started */
  startedAt: string;
  
  /** Timestamp when workflow was interrupted */
  interruptedAt?: string;
  
  /** Priority of the workflow */
  priority?: "critical" | "high" | "normal" | "low";
}

export interface ReconnectPlan {
  /** Unique plan identifier */
  id: string;
  
  /** Provider for which this plan is valid */
  providerId: string;
  
  /** Current reconnection state */
  state: ReconnectState;
  
  /** Type of reconnection needed */
  reconnectType: "token_refresh" | "full_reauth" | "scope_update" | "manual";
  
  /** Required actions to complete reconnection */
  requiredActions: ReconnectAction[];
  
  /** Whether user action is required */
  requiresUserAction: boolean;
  
  /** Estimated time to complete reconnection */
  estimatedTimeMinutes?: number;
  
  /** Auth endpoints for reconnection */
  authEndpoints?: {
    authorization?: string;
    token?: string;
    scopes?: string[];
  };
  
  /** Workflow context preserved for resumption */
  preservedContext?: WorkflowContext;
  
  /** Instructions for the operator */
  instructions: string[];
  
  /** Warnings or caveats */
  warnings?: string[];
  
  /** Created timestamp */
  createdAt: string;
}

export interface ReconnectAction {
  /** Action identifier */
  id: string;
  
  /** Action type */
  type: "open_url" | "copy_value" | "enter_value" | "confirm" | "run_script" | "wait";
  
  /** Description of the action */
  description: string;
  
  /** Whether this action is required or optional */
  required: boolean;
  
  /** Value to copy or enter (if applicable) */
  value?: string;
  
  /** Target URL (for open_url actions) */
  targetUrl?: string;
  
  /** Order index for sequencing */
  order: number;
}

/**
 * Detect what type of reconnection is needed based on the failure
 */
export function detectReconnectType(
  failure: FailureClassification
): ReconnectPlan["reconnectType"] {
  switch (failure.category) {
    case "auth_expired":
      return "token_refresh";
    case "auth_revoked":
      return "full_reauth";
    case "auth_insufficient":
      return "scope_update";
    case "auth_failure":
      return failure.recoveryActions.some(a => a.type === "refresh_token")
        ? "token_refresh"
        : "full_reauth";
    default:
      return "manual";
  }
}

/**
 * Generate a reconnection plan for a failed connector
 */
export function generateReconnectPlan(params: {
  providerId: string;
  failure: FailureClassification;
  workflowContext?: WorkflowContext;
  authEndpoints?: {
    authorization?: string;
    token?: string;
    refresh?: string;
    scopes?: string[];
  };
}): ReconnectPlan {
  const { providerId, failure, workflowContext, authEndpoints } = params;
  
  let reconnectType = detectReconnectType(failure);
  const requiredActions: ReconnectAction[] = [];
  const instructions: string[] = [];
  const warnings: string[] = [];
  
  // Determine state based on failure
  let state: ReconnectState;
  switch (failure.category) {
    case "auth_expired":
      state = "auth_expired";
      break;
    case "auth_revoked":
      state = "auth_revoked";
      break;
    case "auth_failure":
      state = "auth_expired_warning";
      break;
    default:
      state = "idle";
  }
  
  // Generate required actions based on reconnect type
  switch (reconnectType) {
    case "token_refresh":
      if (authEndpoints?.refresh) {
        requiredActions.push({
          id: "refresh_token",
          type: "run_script",
          description: "Attempt automatic token refresh",
          required: true,
          order: 1
        });
        instructions.push(
          "1. The connector will attempt to automatically refresh your authentication token.",
          "2. If successful, the workflow will resume automatically.",
          "3. If automatic refresh fails, you may need to re-authenticate."
        );
      } else {
        reconnectType = "full_reauth";
        instructions.push(
          "1. Automatic token refresh is not available for this provider.",
          "2. You will need to re-authenticate with the provider.",
          "3. Follow the steps for full re-authentication below."
        );
      }
      break;
      
    case "full_reauth":
      if (authEndpoints?.authorization) {
        requiredActions.push({
          id: "open_auth_url",
          type: "open_url",
          description: "Open provider authorization page",
          required: true,
          targetUrl: authEndpoints.authorization,
          order: 1
        });
        
        requiredActions.push({
          id: "copy_auth_code",
          type: "copy_value",
          description: "After authorization, copy the authorization code",
          required: true,
          order: 2
        });
        
        instructions.push(
          "1. Click 'Open provider authorization page' to start re-authentication.",
          "2. Log in to the provider and authorize the application.",
          "3. After authorization, you will be redirected to a callback URL.",
          "4. Copy the authorization code from the URL.",
          "5. Return to the connector and complete the re-authentication."
        );
      } else {
        instructions.push(
          "1. Navigate to your provider's application settings.",
          "2. Revoke the current application access.",
          "3. Re-register the application and obtain new credentials.",
          "4. Update the connector with new credentials."
        );
      }
      
      warnings.push(
        "Re-authentication will require you to manually complete the OAuth flow.",
        "Any in-progress workflows may need to be restarted after re-authentication."
      );
      break;
      
    case "scope_update":
      requiredActions.push({
        id: "update_scopes",
        type: "confirm",
        description: "Confirm updated scope requirements",
        required: true,
        order: 1
      });
      
      if (authEndpoints?.scopes) {
        instructions.push(
          "1. The provider requires additional or different OAuth scopes.",
          `2. Required scopes: ${authEndpoints.scopes.join(", ")}`,
          "3. Click 'Confirm' to proceed with re-authorization with new scopes."
        );
      }
      break;
      
    case "manual":
      instructions.push(
        "Manual reconnection is required for this type of authentication failure.",
        "1. Check the provider's status page for any outages.",
        "2. Verify your credentials are still valid.",
        "3. Contact your administrator if the issue persists."
      );
      
      if (failure.recoveryActions.length > 0) {
        const primaryAction = failure.recoveryActions[0];
        if (primaryAction) {
          instructions.push(
            "",
            `Recommended action: ${primaryAction.description}`
          );
        }
      }
      break;
  }
  
  // Estimate time
  let estimatedTimeMinutes: number | undefined;
  switch (reconnectType) {
    case "token_refresh":
      estimatedTimeMinutes = 1;
      break;
    case "full_reauth":
      estimatedTimeMinutes = 5;
      break;
    case "scope_update":
      estimatedTimeMinutes = 3;
      break;
    case "manual":
      estimatedTimeMinutes = 15;
      break;
  }
  
  return {
    id: `reconnect_${providerId}_${Date.now()}`,
    providerId,
    state,
    reconnectType,
    requiredActions,
    requiresUserAction: requiredActions.some(a => a.required),
    estimatedTimeMinutes,
    authEndpoints,
    preservedContext: workflowContext,
    instructions,
    warnings: warnings.length > 0 ? warnings : undefined,
    createdAt: new Date().toISOString()
  };
}

/**
 * Preserve workflow context for resumption after reconnection
 */
export function preserveWorkflowContext(params: {
  workflowId: string;
  workflowType: string;
  description: string;
  currentStep?: string;
  completedSteps: string[];
  pendingSteps: string[];
  inputParameters: Record<string, unknown>;
  intermediateResults: Record<string, unknown>;
  failure?: FailureClassification;
  priority?: WorkflowContext["priority"];
}): WorkflowContext {
  return {
    workflowId: params.workflowId,
    workflowType: params.workflowType,
    description: params.description,
    currentStep: params.currentStep,
    completedSteps: [...params.completedSteps],
    pendingSteps: [...params.pendingSteps],
    inputParameters: { ...params.inputParameters },
    intermediateResults: { ...params.intermediateResults },
    failure: params.failure,
    startedAt: new Date().toISOString(),
    interruptedAt: new Date().toISOString(),
    priority: params.priority
  };
}

/**
 * Format reconnection plan for operator display
 */
export function formatReconnectPlanForOperator(plan: ReconnectPlan): string {
  const lines = [
    "╔═══════════════════════════════════════════════════════════════╗",
    `║  CONNECTOR RECONNECT PLAN: ${plan.providerId.toUpperCase().padEnd(26)}║`,
    "╠═══════════════════════════════════════════════════════════════╣",
    `║ State:          ${plan.state.toUpperCase().padEnd(44)}║`,
    `║ Reconnect Type: ${plan.reconnectType.replace(/_/g, " ").toUpperCase().padEnd(44)}║`,
    `║ User Action:    ${plan.requiresUserAction ? "REQUIRED" : "NOT REQUIRED".padEnd(36)}║`,
  ];
  
  if (plan.estimatedTimeMinutes) {
    lines.push(`║ Est. Time:      ~${plan.estimatedTimeMinutes} minute(s)${"".padEnd(38 - String(plan.estimatedTimeMinutes).length)}║`);
  }
  
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  lines.push("║  PRESERVED WORKFLOW CONTEXT                                   ║");
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  
  if (plan.preservedContext) {
    const ctx = plan.preservedContext;
    lines.push(`║ Workflow:       ${truncate(ctx.workflowType, 42).padEnd(44)}║`);
    lines.push(`║ Description:    ${truncate(ctx.description, 42).padEnd(44)}║`);
    lines.push(`║ Started:        ${ctx.startedAt.padEnd(44)}║`);
    if (ctx.currentStep) {
      lines.push(`║ Current Step:   ${truncate(ctx.currentStep, 42).padEnd(44)}║`);
    }
    lines.push(`║ Completed:      ${ctx.completedSteps.length} step(s)${"".padEnd(31)}║`);
    lines.push(`║ Pending:        ${ctx.pendingSteps.length} step(s)${"".padEnd(32)}║`);
    
    if (ctx.failure) {
      lines.push("╠═══════════════════════════════════════════════════════════════╣");
      lines.push("║  FAILURE THAT TRIGGERED RECONNECT                             ║");
      lines.push("╠═══════════════════════════════════════════════════════════════╣");
      lines.push(`║ Category:      ${ctx.failure.category.replace(/_/g, " ").padEnd(44)}║`);
      lines.push(`║ Severity:      ${ctx.failure.severity.toUpperCase().padEnd(44)}║`);
      lines.push(`║ Title:         ${truncate(ctx.failure.title, 42).padEnd(44)}║`);
      lines.push(`║ Message:       ${truncate(ctx.failure.displayMessage, 42).padEnd(44)}║`);
    }
  } else {
    lines.push("║ No workflow context preserved                                ║");
  }
  
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  lines.push("║  RECONNECT INSTRUCTIONS                                       ║");
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  
  for (let i = 0; i < plan.instructions.length; i++) {
    const instruction = plan.instructions[i];
    lines.push(`║ ${String(i + 1).padStart(2, " ")}. ${truncate(instruction, 57).padEnd(59)}║`);
  }
  
  if (plan.requiredActions.length > 0) {
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    lines.push("║  REQUIRED ACTIONS                                             ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    
    for (const action of plan.requiredActions) {
      const marker = action.required ? "[REQ]" : "[OPT]";
      const desc = `${action.order}. ${action.description}`;
      lines.push(`║ ${marker} ${truncate(desc, 52).padEnd(56)}║`);
      if (action.targetUrl) {
        lines.push(`║     URL: ${truncate(action.targetUrl, 53).padEnd(55)}║`);
      }
    }
  }
  
  if (plan.warnings && plan.warnings.length > 0) {
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    lines.push("║  WARNINGS                                                      ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    
    for (const warning of plan.warnings) {
      lines.push(`║ ⚠ ${truncate(warning, 57).padEnd(59)}║`);
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
 * Create a reconnect plan from a connector failure event
 */
export function createReconnectPlanFromFailure(params: {
  providerId: string;
  errorMessage?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  workflowContext?: WorkflowContext;
  authEndpoints?: {
    authorization?: string;
    token?: string;
    refresh?: string;
    scopes?: string[];
  };
}): ReconnectPlan {
  const { providerId, errorMessage, statusCode, headers, workflowContext, authEndpoints } = params;
  
  const failure = classifyFailure({
    providerId,
    errorMessage,
    statusCode,
    headers
  });
  
  return generateReconnectPlan({
    providerId,
    failure,
    workflowContext,
    authEndpoints
  });
}

export default {
  detectReconnectType,
  generateReconnectPlan,
  preserveWorkflowContext,
  formatReconnectPlanForOperator,
  createReconnectPlanFromFailure
};
