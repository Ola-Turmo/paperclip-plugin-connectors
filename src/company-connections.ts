import { randomUUID } from "node:crypto";

export const CONNECTIONS_NAMESPACE = "company-connections";
export const CONNECTIONS_STATE_KEY = "registry";

export type CompanyConnectionStatus =
  | "draft"
  | "connected"
  | "needs_attention"
  | "paused"
  | "disconnected";

export type CompanyConnectionUsage =
  | "email"
  | "social"
  | "ads"
  | "analytics"
  | "crm"
  | "commerce"
  | "support"
  | "other";

export interface CompanyConnectionRecord {
  id: string;
  companyId: string;
  providerId: string;
  label: string;
  accountIdentifier: string;
  usage: CompanyConnectionUsage;
  status: CompanyConnectionStatus;
  scopes: string[];
  channels: string[];
  secretRefs: {
    primary?: string;
    refresh?: string;
    webhook?: string;
  };
  notes: string;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string | null;
  lastValidationMessage?: string | null;
}

export interface CompanyConnectionDraft {
  id?: string;
  providerId: string;
  label: string;
  accountIdentifier: string;
  usage?: CompanyConnectionUsage;
  status?: CompanyConnectionStatus;
  scopes?: string[];
  channels?: string[];
  secretRefs?: {
    primary?: string;
    refresh?: string;
    webhook?: string;
  };
  secretRef?: string;
  notes?: string;
  lastValidatedAt?: string | null;
  lastValidationMessage?: string | null;
}

const VALID_STATUSES = new Set<CompanyConnectionStatus>([
  "draft",
  "connected",
  "needs_attention",
  "paused",
  "disconnected",
]);

const VALID_USAGES = new Set<CompanyConnectionUsage>([
  "email",
  "social",
  "ads",
  "analytics",
  "crm",
  "commerce",
  "support",
  "other",
]);

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item))
    .filter(Boolean);
}

function cleanSecretRefs(
  input: Pick<CompanyConnectionDraft, "secretRefs" | "secretRef">,
): CompanyConnectionRecord["secretRefs"] {
  const primary =
    cleanString(input.secretRefs?.primary) ||
    cleanString(input.secretRef);
  return {
    ...(primary ? { primary } : {}),
    ...(cleanString(input.secretRefs?.refresh) ? { refresh: cleanString(input.secretRefs?.refresh) } : {}),
    ...(cleanString(input.secretRefs?.webhook) ? { webhook: cleanString(input.secretRefs?.webhook) } : {}),
  };
}

export function assertCompanyId(input: unknown): string {
  const companyId = cleanString(input);
  if (!companyId) {
    throw new Error("companyId is required");
  }
  return companyId;
}

export function normalizeCompanyConnection(
  companyId: string,
  input: CompanyConnectionDraft,
  nowIso: string = new Date().toISOString(),
): CompanyConnectionRecord {
  const providerId = cleanString(input.providerId);
  const label = cleanString(input.label);
  const accountIdentifier = cleanString(input.accountIdentifier);

  if (!providerId) throw new Error("providerId is required");
  if (!label) throw new Error("label is required");
  if (!accountIdentifier) throw new Error("accountIdentifier is required");

  const usage = VALID_USAGES.has(input.usage ?? "other")
    ? (input.usage ?? "other")
    : "other";
  const status = VALID_STATUSES.has(input.status ?? "draft")
    ? (input.status ?? "draft")
    : "draft";

  return {
    id: cleanString(input.id) || randomUUID(),
    companyId,
    providerId,
    label,
    accountIdentifier,
    usage,
    status,
    scopes: cleanStringArray(input.scopes),
    channels: cleanStringArray(input.channels),
    secretRefs: cleanSecretRefs(input),
    notes: cleanString(input.notes),
    createdAt: nowIso,
    updatedAt: nowIso,
    lastValidatedAt: input.lastValidatedAt ?? null,
    lastValidationMessage: cleanString(input.lastValidationMessage) || null,
  };
}

export function mergeCompanyConnection(
  existing: CompanyConnectionRecord | undefined,
  next: CompanyConnectionRecord,
): CompanyConnectionRecord {
  if (!existing) return next;
  return {
    ...existing,
    ...next,
    companyId: existing.companyId,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: next.updatedAt,
  };
}

export function sortCompanyConnections(records: CompanyConnectionRecord[]): CompanyConnectionRecord[] {
  return [...records].sort((left, right) => {
    if (left.providerId !== right.providerId) {
      return left.providerId.localeCompare(right.providerId);
    }
    return left.label.localeCompare(right.label);
  });
}

export function summarizeCompanyConnections(records: CompanyConnectionRecord[]) {
  const statusCounts: Record<string, number> = {};
  const usageCounts: Record<string, number> = {};
  const providerCounts: Record<string, number> = {};

  for (const record of records) {
    statusCounts[record.status] = (statusCounts[record.status] ?? 0) + 1;
    usageCounts[record.usage] = (usageCounts[record.usage] ?? 0) + 1;
    providerCounts[record.providerId] = (providerCounts[record.providerId] ?? 0) + 1;
  }

  const warnings: string[] = [];
  const duplicatedAccounts = new Set<string>();
  for (const record of records) {
    const key = `${record.providerId}::${record.accountIdentifier.toLowerCase()}`;
    if (duplicatedAccounts.has(key)) {
      warnings.push(`Duplicate account identifier detected for ${record.providerId}: ${record.accountIdentifier}`);
      continue;
    }
    duplicatedAccounts.add(key);
  }

  return {
    totalConnections: records.length,
    statusCounts,
    usageCounts,
    providerCounts,
    warnings,
  };
}
