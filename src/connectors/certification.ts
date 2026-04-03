/**
 * Connector Certification
 * 
 * Defines certification criteria for connector promotion and verifies that connectors
 * meet operational readiness requirements before being marked as production-ready.
 * 
 * This module implements UOS-FOUND-CONN-003: Certified connectors meet operational 
 * readiness before promotion.
 */

export type CertificationStatus = 
  | "uncertified"    // Not yet certified
  | "in_progress"    // Certification in progress
  | "certified"      // Fully certified
  | "deprecated"     // Certification deprecated
  | "revoked";      // Certification revoked

export interface CertificationCriteria {
  /** Unique criteria identifier */
  id: string;
  
  /** Criteria name */
  name: string;
  
  /** Detailed description */
  description: string;
  
  /** Category of criteria */
  category: "success_path" | "fallback_path" | "audit_coverage" | "security" | "reliability";
  
  /** Whether this criteria is required for certification */
  required: boolean;
  
  /** Verification method */
  verificationMethod: "automated" | "manual_review" | "contract_test" | "smoke_test";
  
  /** Check function or script */
  checkIdentifier: string;
}

export interface CertificationRequirement {
  criteriaId: string;
  status: "met" | "unmet" | "in_progress" | "not_applicable";
  evidence?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface CertificationReport {
  /** Unique report identifier */
  id: string;
  
  /** Provider being certified */
  providerId: string;
  
  /** Certification status */
  status: CertificationStatus;
  
  /** Timestamp when certification was requested */
  requestedAt: string;
  
  /** Timestamp when certification was completed */
  completedAt?: string;
  
  /** Who/what requested certification */
  requestedBy: string;
  
  /** Certification requirements and their status */
  requirements: CertificationRequirement[];
  
  /** Overall assessment */
  overallAssessment: {
    passed: boolean;
    score: number; // 0-100
    summary: string;
  };
  
  /** Certification validity period */
  validFrom?: string;
  validUntil?: string;
  
  /** Known limitations or caveats */
  caveats?: string[];
  
  /** Warning for uncertified or partial certification */
  promotionBlockers: string[];
}

export const CERTIFICATION_CRITERIA: CertificationCriteria[] = [
  // Success Path Coverage
  {
    id: "success_path_core",
    name: "Core Operations Success",
    description: "Connector successfully handles core CRUD operations for primary resources",
    category: "success_path",
    required: true,
    verificationMethod: "smoke_test",
    checkIdentifier: "smoke:core_operations"
  },
  {
    id: "success_path_auth",
    name: "Authentication Success",
    description: "Connector successfully authenticates using supported auth models",
    category: "success_path",
    required: true,
    verificationMethod: "smoke_test",
    checkIdentifier: "smoke:authentication"
  },
  {
    id: "success_path_events",
    name: "Event Handling",
    description: "Connector correctly receives and processes events (webhooks, polling)",
    category: "success_path",
    required: true,
    verificationMethod: "contract_test",
    checkIdentifier: "contract:event_handling"
  },
  
  // Fallback Path Coverage
  {
    id: "fallback_available",
    name: "Fallback Path Exists",
    description: "Alternative path available when primary API is unavailable",
    category: "fallback_path",
    required: true,
    verificationMethod: "manual_review",
    checkIdentifier: "review:fallback_availability"
  },
  {
    id: "fallback_tested",
    name: "Fallback Path Tested",
    description: "Fallback path has been tested and documented",
    category: "fallback_path",
    required: true,
    verificationMethod: "contract_test",
    checkIdentifier: "contract:fallback_tested"
  },
  {
    id: "degraded_mode",
    name: "Degraded Mode Operation",
    description: "Connector operates gracefully in degraded mode when provider is impaired",
    category: "fallback_path",
    required: false,
    verificationMethod: "smoke_test",
    checkIdentifier: "smoke:degraded_mode"
  },
  
  // Audit Coverage
  {
    id: "audit_events",
    name: "Audit Event Emission",
    description: "Connector emits structured audit events for all significant operations",
    category: "audit_coverage",
    required: true,
    verificationMethod: "contract_test",
    checkIdentifier: "contract:audit_events"
  },
  {
    id: "audit_errors",
    name: "Error Audit Logging",
    description: "All errors are logged with sufficient context for debugging",
    category: "audit_coverage",
    required: true,
    verificationMethod: "contract_test",
    checkIdentifier: "contract:error_audit"
  },
  {
    id: "audit_telemetry",
    name: "Operational Telemetry",
    description: "Connector emits operational telemetry (latency, throughput, errors)",
    category: "audit_coverage",
    required: true,
    verificationMethod: "automated",
    checkIdentifier: "automated:telemetry"
  },
  
  // Security
  {
    id: "security_scopes",
    name: "Scope Minimization",
    description: "Connector requests only minimum necessary OAuth scopes",
    category: "security",
    required: true,
    verificationMethod: "manual_review",
    checkIdentifier: "review:scope_minimization"
  },
  {
    id: "security_token_storage",
    name: "Secure Token Storage",
    description: "Tokens are stored securely and not exposed in logs or errors",
    category: "security",
    required: true,
    verificationMethod: "manual_review",
    checkIdentifier: "review:token_storage"
  },
  {
    id: "security_callback_validation",
    name: "Callback Signature Validation",
    description: "All callbacks/webhooks are signature-verified before processing",
    category: "security",
    required: true,
    verificationMethod: "automated",
    checkIdentifier: "automated:callback_validation"
  },
  
  // Reliability
  {
    id: "reliability_retries",
    name: "Retry Logic",
    description: "Connector implements appropriate retry logic with backoff",
    category: "reliability",
    required: true,
    verificationMethod: "contract_test",
    checkIdentifier: "contract:retry_logic"
  },
  {
    id: "reliability_rate_limits",
    name: "Rate Limit Handling",
    description: "Connector respects and handles provider rate limits",
    category: "reliability",
    required: true,
    verificationMethod: "smoke_test",
    checkIdentifier: "smoke:rate_limits"
  },
  {
    id: "reliability_circuit_breaker",
    name: "Circuit Breaker Pattern",
    description: "Connector implements circuit breaker to prevent cascade failures",
    category: "reliability",
    required: false,
    verificationMethod: "manual_review",
    checkIdentifier: "review:circuit_breaker"
  },
  {
    id: "reliability_reconciliation",
    name: "Callback Reconciliation",
    description: "Connector can reconcile missed callbacks after outages",
    category: "reliability",
    required: true,
    verificationMethod: "contract_test",
    checkIdentifier: "contract:reconciliation"
  }
];

/**
 * Get all certification criteria
 */
export function getCertificationCriteria(): CertificationCriteria[] {
  return [...CERTIFICATION_CRITERIA];
}

/**
 * Get criteria by category
 */
export function getCriteriaByCategory(
  category: CertificationCriteria["category"]
): CertificationCriteria[] {
  return CERTIFICATION_CRITERIA.filter(c => c.category === category);
}

/**
 * Get required criteria only
 */
export function getRequiredCriteria(): CertificationCriteria[] {
  return CERTIFICATION_CRITERIA.filter(c => c.required);
}

/**
 * Check if a provider can be promoted to production
 * Returns a certification report
 */
export function checkPromotionEligibility(
  providerId: string,
  testResults?: Record<string, "passed" | "failed" | "pending">
): CertificationReport {
  const requiredCriteria = getRequiredCriteria();
  
  const requirements: CertificationRequirement[] = CERTIFICATION_CRITERIA.map(criteria => {
    const testResult = testResults?.[criteria.checkIdentifier];
    
    let status: CertificationRequirement["status"];
    if (criteria.verificationMethod === "manual_review" && !testResult) {
      status = "in_progress";
    } else if (testResult === "passed") {
      status = "met";
    } else if (testResult === "failed") {
      status = "unmet";
    } else {
      status = "in_progress";
    }
    
    return {
      criteriaId: criteria.id,
      status,
      evidence: testResult ? `Test result: ${testResult}` : undefined,
      verifiedAt: testResult ? new Date().toISOString() : undefined
    };
  });
  
  // Calculate overall assessment
  const metCount = requirements.filter(r => r.status === "met").length;
  const totalCount = requirements.length;
  const score = Math.round((metCount / totalCount) * 100);
  
  // Certification requires all required criteria to be "met"
  // "in_progress" or "unmet" for required criteria are blockers
  const blockingRequirements = requirements.filter(r => 
    (r.status === "unmet" || r.status === "in_progress") && 
    CERTIFICATION_CRITERIA.find(c => c.id === r.criteriaId)?.required
  );
  
  const blockers = blockingRequirements.map(r => {
    const criteria = CERTIFICATION_CRITERIA.find(c => c.id === r.criteriaId);
    const statusStr = r.status === "in_progress" ? "in progress" : "unmet";
    return criteria 
      ? `${criteria.name}: ${criteria.description} (${statusStr})`
      : `Unknown criteria: ${r.criteriaId}`;
  });
  
  const passed = blockers.length === 0;
  
  let summary: string;
  if (passed) {
    summary = `All ${requiredCriteria.length} required criteria met. Connector is eligible for production promotion.`;
  } else {
    summary = `${blockers.length} blocking issue(s) must be resolved before production promotion.`;
  }
  
  return {
    id: `cert_${providerId}_${Date.now()}`,
    providerId,
    status: passed ? "certified" : "uncertified",
    requestedAt: new Date().toISOString(),
    completedAt: passed ? new Date().toISOString() : undefined,
    requestedBy: "UOS Platform",
    requirements,
    overallAssessment: {
      passed,
      score,
      summary
    },
    validFrom: passed ? new Date().toISOString() : undefined,
    validUntil: passed 
      ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
      : undefined,
    caveats: blockers.length > 0 
      ? ["Certification is conditional on resolving blocking issues"]
      : undefined,
    promotionBlockers: blockers
  };
}

/**
 * Generate a human-readable certification summary
 */
export function generateCertificationSummary(report: CertificationReport): string {
  const lines = [
    "═══════════════════════════════════════════════════════════════",
    `CONNECTOR CERTIFICATION REPORT: ${report.providerId}`,
    "═══════════════════════════════════════════════════════════════",
    "",
    `Status:        ${report.status.toUpperCase()}`,
    `Score:         ${report.overallAssessment.score}/100`,
    `Requested:     ${report.requestedAt}`,
    `Completed:     ${report.completedAt ?? "In progress"}`,
    "",
    "─────────────────── ASSESSMENT ───────────────────",
    "",
    report.overallAssessment.summary,
    "",
  ];
  
  if (report.promotionBlockers.length > 0) {
    lines.push("─────────────────── BLOCKERS ────────────────────");
    lines.push("");
    for (const blocker of report.promotionBlockers) {
      lines.push(`  ✗ ${blocker}`);
    }
    lines.push("");
  }
  
  // Group by category
  const categories: Array<CertificationCriteria["category"]> = [
    "success_path", "fallback_path", "audit_coverage", "security", "reliability"
  ];
  
  for (const cat of categories) {
    const catCriteria = CERTIFICATION_CRITERIA.filter(c => c.category === cat);
    const catRequirements = report.requirements.filter(r => 
      catCriteria.some(c => c.id === r.criteriaId)
    );
    
    if (catRequirements.length === 0) continue;
    
    const catPassed = catRequirements.filter(r => r.status === "met").length;
    const catTotal = catRequirements.length;
    
    lines.push(`──────────────── ${cat.toUpperCase().replace("_", " ")} [${catPassed}/${catTotal}] ───────────────`);
    lines.push("");
    
    for (const req of catRequirements) {
      const criteria = catCriteria.find(c => c.id === req.criteriaId)!;
      const icon = req.status === "met" ? "✓" : 
                   req.status === "unmet" ? "✗" : 
                   req.status === "in_progress" ? "⏳" : "N/A";
      const marker = criteria.required ? "[REQ]" : "[OPT]";
      lines.push(`  ${icon} ${marker} ${criteria.name}`);
    }
    lines.push("");
  }
  
  if (report.validUntil) {
    lines.push(`Valid Until:   ${report.validUntil}`);
  }
  
  if (report.caveats && report.caveats.length > 0) {
    lines.push("");
    lines.push("Caveats:");
    for (const caveat of report.caveats) {
      lines.push(`  - ${caveat}`);
    }
  }
  
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════");
  
  return lines.join("\n");
}

/**
 * Check if a connector is certified for production use
 */
export function isCertifiedForProduction(report: CertificationReport): boolean {
  return report.status === "certified" && 
         report.overallAssessment.passed &&
         report.promotionBlockers.length === 0;
}

/**
 * Check if a connector has blocking issues for promotion
 */
export function hasPromotionBlockers(report: CertificationReport): boolean {
  return report.promotionBlockers.length > 0;
}

export default {
  CERTIFICATION_CRITERIA,
  getCertificationCriteria,
  getCriteriaByCategory,
  getRequiredCriteria,
  checkPromotionEligibility,
  generateCertificationSummary,
  isCertifiedForProduction,
  hasPromotionBlockers
};
