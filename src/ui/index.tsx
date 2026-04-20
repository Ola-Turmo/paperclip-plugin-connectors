import { useMemo, useState, type CSSProperties } from "react";
import {
  usePluginAction,
  usePluginData,
  usePluginToast,
  type PluginPageProps,
  type PluginSettingsPageProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";

type ProviderCatalogRow = {
  providerId: string;
  displayName: string;
  category: string;
  certified: boolean;
  authModel: string[];
  eventModel: string;
  writeBoundary: string;
  supportsTokenRefresh: boolean;
  lifecycleState: string;
};

type CompanyConnectionRecord = {
  id: string;
  companyId: string;
  providerId: string;
  label: string;
  accountIdentifier: string;
  usage: string;
  status: string;
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
};

type CompanyConnectionsResponse = {
  companyId: string;
  connections: CompanyConnectionRecord[];
  summary: {
    totalConnections: number;
    statusCounts: Record<string, number>;
    usageCounts: Record<string, number>;
    providerCounts: Record<string, number>;
    warnings: string[];
  };
};

type ProviderCatalogResponse = {
  providers: ProviderCatalogRow[];
};

type EditableConnection = {
  id?: string;
  providerId: string;
  label: string;
  accountIdentifier: string;
  usage: string;
  status: string;
  scopes: string;
  channels: string;
  primarySecretRef: string;
  refreshSecretRef: string;
  webhookSecretRef: string;
  notes: string;
};

const USAGE_OPTIONS = [
  "email",
  "social",
  "ads",
  "analytics",
  "crm",
  "commerce",
  "support",
  "other",
] as const;

const STATUS_OPTIONS = [
  "draft",
  "connected",
  "needs_attention",
  "paused",
  "disconnected",
] as const;

const CARD_STYLE: CSSProperties = {
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(255,255,255,0.9)",
};

function blankConnection(providerId = "slack"): EditableConnection {
  return {
    providerId,
    label: "",
    accountIdentifier: "",
    usage: "email",
    status: "draft",
    scopes: "",
    channels: "",
    primarySecretRef: "",
    refreshSecretRef: "",
    webhookSecretRef: "",
    notes: "",
  };
}

function listToCsv(values: string[] | undefined) {
  return (values ?? []).join(", ");
}

function csvToList(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function toEditableConnection(record: CompanyConnectionRecord): EditableConnection {
  return {
    id: record.id,
    providerId: record.providerId,
    label: record.label,
    accountIdentifier: record.accountIdentifier,
    usage: record.usage,
    status: record.status,
    scopes: listToCsv(record.scopes),
    channels: listToCsv(record.channels),
    primarySecretRef: record.secretRefs.primary ?? "",
    refreshSecretRef: record.secretRefs.refresh ?? "",
    webhookSecretRef: record.secretRefs.webhook ?? "",
    notes: record.notes,
  };
}

function SectionTitle(props: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <strong style={{ fontSize: 16 }}>{props.title}</strong>
      {props.subtitle ? <span style={{ color: "#586173", fontSize: 13 }}>{props.subtitle}</span> : null}
    </div>
  );
}

function CompanyScopedNotice(props: { companyId: string | null }) {
  if (props.companyId) return null;
  return (
    <div style={{ ...CARD_STYLE, background: "#fff7e8", borderColor: "#f1d395" }}>
      <strong>Open this inside a company</strong>
      <div style={{ marginTop: 6, color: "#6d5c33" }}>
        Connector accounts are intentionally company-scoped. Open this plugin from a company route to add or edit that
        company&apos;s Gmail, social, analytics, or CRM credentials without leaking across the portfolio.
      </div>
    </div>
  );
}

function RegistrySummary(props: { summary: CompanyConnectionsResponse["summary"] }) {
  return (
    <div style={{ ...CARD_STYLE, display: "grid", gap: 10 }}>
      <SectionTitle
        title="Company Connector Registry"
        subtitle="Every account record stays inside one company scope. Use one provider account per brand surface when separation matters."
      />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div><strong>{props.summary.totalConnections}</strong> connections</div>
        <div><strong>{Object.keys(props.summary.providerCounts).length}</strong> providers</div>
        <div><strong>{props.summary.statusCounts.connected ?? 0}</strong> connected</div>
        <div><strong>{props.summary.statusCounts.needs_attention ?? 0}</strong> need attention</div>
      </div>
      {props.summary.warnings.length > 0 ? (
        <div style={{ color: "#8a4b16", display: "grid", gap: 4 }}>
          {props.summary.warnings.map((warning) => <div key={warning}>- {warning}</div>)}
        </div>
      ) : (
        <div style={{ color: "#4f6b55" }}>No duplicate provider/account combinations detected in this company.</div>
      )}
    </div>
  );
}

function ConnectionEditor(props: {
  companyId: string;
  providers: ProviderCatalogRow[];
  selected: EditableConnection;
  onChange(next: EditableConnection): void;
  onSaved(): void;
  onCancel(): void;
}) {
  const save = usePluginAction("upsertCompanyConnection");
  const toast = usePluginToast();
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await save({
        companyId: props.companyId,
        connection: {
          id: props.selected.id,
          providerId: props.selected.providerId,
          label: props.selected.label,
          accountIdentifier: props.selected.accountIdentifier,
          usage: props.selected.usage,
          status: props.selected.status,
          scopes: csvToList(props.selected.scopes),
          channels: csvToList(props.selected.channels),
          secretRefs: {
            ...(props.selected.primarySecretRef ? { primary: props.selected.primarySecretRef } : {}),
            ...(props.selected.refreshSecretRef ? { refresh: props.selected.refreshSecretRef } : {}),
            ...(props.selected.webhookSecretRef ? { webhook: props.selected.webhookSecretRef } : {}),
          },
          notes: props.selected.notes,
        },
      });
      toast({
        title: props.selected.id ? "Connector updated" : "Connector saved",
        body: `${props.selected.label} is now bound to company ${props.companyId}.`,
        tone: "success",
      });
      props.onSaved();
    } catch (error) {
      toast({
        title: "Save failed",
        body: error instanceof Error ? error.message : "Unknown error",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ ...CARD_STYLE, display: "grid", gap: 12 }}>
      <SectionTitle
        title={props.selected.id ? "Edit company account" : "Add company account"}
        subtitle="Store the metadata here, keep real credentials in company secrets, and never reuse one company account record across unrelated brands unless you mean to."
      />
      <div style={{ display: "grid", gap: 10 }}>
        <label>
          <div>Provider</div>
          <select
            value={props.selected.providerId}
            onChange={(event) => props.onChange({ ...props.selected, providerId: event.target.value })}
          >
            {props.providers.map((provider) => (
              <option key={provider.providerId} value={provider.providerId}>
                {provider.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div>Label</div>
          <input
            value={props.selected.label}
            onChange={(event) => props.onChange({ ...props.selected, label: event.target.value })}
            placeholder="Kurs.ing Gmail support"
          />
        </label>
        <label>
          <div>Account identifier</div>
          <input
            value={props.selected.accountIdentifier}
            onChange={(event) => props.onChange({ ...props.selected, accountIdentifier: event.target.value })}
            placeholder="support@kurs.ing or @parallelcompanyai"
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            <div>Usage</div>
            <select
              value={props.selected.usage}
              onChange={(event) => props.onChange({ ...props.selected, usage: event.target.value })}
            >
              {USAGE_OPTIONS.map((usage) => <option key={usage} value={usage}>{usage}</option>)}
            </select>
          </label>
          <label>
            <div>Status</div>
            <select
              value={props.selected.status}
              onChange={(event) => props.onChange({ ...props.selected, status: event.target.value })}
            >
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
        <label>
          <div>Scopes</div>
          <input
            value={props.selected.scopes}
            onChange={(event) => props.onChange({ ...props.selected, scopes: event.target.value })}
            placeholder="gmail.readonly, gmail.send"
          />
        </label>
        <label>
          <div>Channels</div>
          <input
            value={props.selected.channels}
            onChange={(event) => props.onChange({ ...props.selected, channels: event.target.value })}
            placeholder="email, onboarding, support"
          />
        </label>
        <label>
          <div>Primary secret ref</div>
          <input
            value={props.selected.primarySecretRef}
            onChange={(event) => props.onChange({ ...props.selected, primarySecretRef: event.target.value })}
            placeholder="Company secret UUID for the main access token or API key"
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            <div>Refresh secret ref</div>
            <input
              value={props.selected.refreshSecretRef}
              onChange={(event) => props.onChange({ ...props.selected, refreshSecretRef: event.target.value })}
              placeholder="Optional refresh token secret UUID"
            />
          </label>
          <label>
            <div>Webhook secret ref</div>
            <input
              value={props.selected.webhookSecretRef}
              onChange={(event) => props.onChange({ ...props.selected, webhookSecretRef: event.target.value })}
              placeholder="Optional webhook secret UUID"
            />
          </label>
        </div>
        <label>
          <div>Notes</div>
          <textarea
            rows={4}
            value={props.selected.notes}
            onChange={(event) => props.onChange({ ...props.selected, notes: event.target.value })}
            placeholder="Why this account exists, who owns it, and what should never be shared across companies."
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving…" : props.selected.id ? "Save changes" : "Add account"}
        </button>
        <button onClick={props.onCancel} disabled={saving}>Reset</button>
      </div>
    </div>
  );
}

function ConnectionsTable(props: {
  companyId: string;
  connections: CompanyConnectionRecord[];
  onEdit(record: CompanyConnectionRecord): void;
  onDeleted(): void;
}) {
  const remove = usePluginAction("deleteCompanyConnection");
  const toast = usePluginToast();

  async function handleDelete(record: CompanyConnectionRecord) {
    try {
      await remove({ companyId: props.companyId, connectionId: record.id });
      toast({
        title: "Connector removed",
        body: `${record.label} was removed from this company registry.`,
        tone: "success",
      });
      props.onDeleted();
    } catch (error) {
      toast({
        title: "Delete failed",
        body: error instanceof Error ? error.message : "Unknown error",
        tone: "error",
      });
    }
  }

  if (props.connections.length === 0) {
    return (
      <div style={{ ...CARD_STYLE, color: "#586173" }}>
        No company-scoped accounts yet. Add one before wiring company-specific email, social, analytics, or CRM automations.
      </div>
    );
  }

  return (
    <div style={{ ...CARD_STYLE, display: "grid", gap: 10 }}>
      <SectionTitle title="Current company accounts" subtitle="These records belong only to the current company scope." />
      <div style={{ display: "grid", gap: 10 }}>
        {props.connections.map((record) => (
          <div
            key={record.id}
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              padding: 12,
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong>{record.label}</strong>
              <span>{record.status}</span>
            </div>
            <div>{record.providerId} · {record.accountIdentifier}</div>
            <div style={{ color: "#586173", fontSize: 13 }}>
              Usage: {record.usage} · Scopes: {record.scopes.join(", ") || "none listed"}
            </div>
            {record.notes ? <div style={{ color: "#586173", fontSize: 13 }}>{record.notes}</div> : null}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => props.onEdit(record)}>Edit</button>
              <button onClick={() => void handleDelete(record)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyConnectionsManager(props: { companyId: string | null }) {
  const providerCatalog = usePluginData<ProviderCatalogResponse>("providerCatalog", {});
  const connections = usePluginData<CompanyConnectionsResponse>(
    "companyConnections",
    props.companyId ? { companyId: props.companyId } : {},
  );
  const [draft, setDraft] = useState<EditableConnection>(blankConnection());

  const providers = providerCatalog.data?.providers ?? [];
  const selectedProviderId = useMemo(
    () => draft.providerId || providers[0]?.providerId || "slack",
    [draft.providerId, providers],
  );

  if (!props.companyId) {
    return <CompanyScopedNotice companyId={props.companyId} />;
  }

  if (providerCatalog.loading || connections.loading) {
    return <div style={CARD_STYLE}>Loading company connector registry…</div>;
  }

  if (providerCatalog.error) {
    return <div style={CARD_STYLE}>Provider catalog error: {providerCatalog.error.message}</div>;
  }

  if (connections.error) {
    return <div style={CARD_STYLE}>Connection registry error: {connections.error.message}</div>;
  }

  const safeDraft = { ...draft, providerId: selectedProviderId };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <RegistrySummary summary={connections.data?.summary ?? {
        totalConnections: 0,
        statusCounts: {},
        usageCounts: {},
        providerCounts: {},
        warnings: [],
      }} />
      <ConnectionEditor
        companyId={props.companyId}
        providers={providers}
        selected={safeDraft}
        onChange={setDraft}
        onSaved={() => {
          connections.refresh();
          setDraft(blankConnection(selectedProviderId));
        }}
        onCancel={() => setDraft(blankConnection(selectedProviderId))}
      />
      <ConnectionsTable
        companyId={props.companyId}
        connections={connections.data?.connections ?? []}
        onEdit={(record) => setDraft(toEditableConnection(record))}
        onDeleted={() => connections.refresh()}
      />
    </div>
  );
}

export function DashboardWidget(props: PluginWidgetProps) {
  const companyId = props.context.companyId;
  const { data, loading, error } = usePluginData<CompanyConnectionsResponse>(
    "companyConnections",
    companyId ? { companyId } : {},
  );

  if (!companyId) {
    return (
      <div style={CARD_STYLE}>
        <strong>Plugin Connectors</strong>
        <div style={{ marginTop: 8 }}>Open this widget from a company dashboard to see that company&apos;s account registry.</div>
      </div>
    );
  }

  if (loading) return <div style={CARD_STYLE}>Loading connector health…</div>;
  if (error) return <div style={CARD_STYLE}>Plugin error: {error.message}</div>;

  return (
    <div style={{ ...CARD_STYLE, display: "grid", gap: 8 }}>
      <strong>Company Connectors</strong>
      <div>{data?.summary.totalConnections ?? 0} accounts scoped to this company</div>
      <div>{data?.summary.statusCounts.connected ?? 0} connected · {data?.summary.statusCounts.needs_attention ?? 0} need attention</div>
      {data?.summary.warnings.length ? <div style={{ color: "#8a4b16" }}>{data.summary.warnings[0]}</div> : null}
      <div style={{ color: "#586173", fontSize: 12 }}>Use the Company Connectors page to keep Gmail, social, and other accounts isolated per company.</div>
    </div>
  );
}

export function CompanyConnectorsPage(props: PluginPageProps) {
  return (
    <div style={{ display: "grid", gap: 16, padding: 16 }}>
      <SectionTitle
        title="Company Connectors"
        subtitle="Bind external accounts to the current company only. This registry is designed to stop account overflow across brands and operating entities."
      />
      <CompanyConnectionsManager companyId={props.context.companyId} />
    </div>
  );
}

export function ConnectorSettingsPage(_props: PluginSettingsPageProps) {
  return (
    <div style={{ display: "grid", gap: 16, padding: 16 }}>
      <SectionTitle
        title="Connector Isolation Rules"
        subtitle="The plugin stores connector metadata only in company scope. Credentials should stay in company secrets and be referenced per company, never shared implicitly."
      />
      <div style={CARD_STYLE}>
        <div>- Use one connection record per company/account pair.</div>
        <div>- If two companies truly share one external account, record that deliberately instead of assuming reuse.</div>
        <div>- Keep raw credentials in company secrets; use secret references in the connector record.</div>
        <div>- Treat email, social, analytics, ads, CRM, and webhook identities as owned operating assets, not instance-global defaults.</div>
      </div>
    </div>
  );
}
