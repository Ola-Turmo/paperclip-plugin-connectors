/**
 * Connector Platform Module Index
 * 
 * Exports all connector platform capabilities:
 * - Capability Registry
 * - Failure Classification
 * - Certification
 * - Reconnect Flow
 * - Callback Reconciliation
 * - Rate Limit Visibility
 */

export * from "./capability-registry.js";
export * from "./failure-classifier.js";
export * from "./certification.js";
export * from "./reconnect.js";
export * from "./callback-reconciliation.js";
export * from "./rate-limit.js";

import * as capabilityRegistry from "./capability-registry.js";
import * as failureClassifier from "./failure-classifier.js";
import * as certification from "./certification.js";
import * as reconnect from "./reconnect.js";
import * as callbackReconciliation from "./callback-reconciliation.js";
import * as rateLimit from "./rate-limit.js";

export default {
  capabilityRegistry,
  failureClassifier,
  certification,
  reconnect,
  callbackReconciliation,
  rateLimit
};
