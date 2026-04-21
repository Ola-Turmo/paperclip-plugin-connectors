export type ConnectorQuickStart = {
  id: string;
  providerId: string;
  title: string;
  subtitle: string;
  usage: "email" | "social" | "ads" | "analytics" | "crm" | "commerce" | "support" | "other";
  suggestedLabel: string;
  accountHint: string;
  scopes: string[];
  channels: string[];
  notes: string;
};

export type ConnectorQuickStartBundle = {
  id: string;
  title: string;
  subtitle: string;
  quickStartIds: string[];
};

export const CONNECTOR_QUICK_STARTS: ConnectorQuickStart[] = [
  {
    id: "instagram-brand",
    providerId: "instagram",
    title: "Instagram brand account",
    subtitle: "Per-company social publishing and engagement surface",
    usage: "social",
    suggestedLabel: "Instagram primary",
    accountHint: "@companyhandle",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_manage_metadata"],
    channels: ["instagram", "social", "community"],
    notes: "Use one record per brand/account. Keep long-lived tokens and webhook secrets in company secrets.",
  },
  {
    id: "facebook-page",
    providerId: "facebook",
    title: "Facebook page",
    subtitle: "Page publishing, moderation, and audience management",
    usage: "social",
    suggestedLabel: "Facebook page",
    accountHint: "facebook.com/your-page or page id",
    scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement"],
    channels: ["facebook", "social", "community"],
    notes: "Bind each company to its own page/account pair to avoid posting across brands by mistake.",
  },
  {
    id: "x-brand",
    providerId: "x",
    title: "X / Twitter brand account",
    subtitle: "Posting, reply handling, and lightweight monitoring",
    usage: "social",
    suggestedLabel: "X primary",
    accountHint: "@companyhandle",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    channels: ["x", "social", "thought-leadership"],
    notes: "Keep write access isolated per company. If one operator manages several brands, create separate company records anyway.",
  },
  {
    id: "linkedin-company",
    providerId: "linkedin",
    title: "LinkedIn company presence",
    subtitle: "Company page publishing and B2B authority workflows",
    usage: "social",
    suggestedLabel: "LinkedIn company page",
    accountHint: "linkedin.com/company/your-company",
    scopes: ["r_organization_social", "w_organization_social", "r_basicprofile"],
    channels: ["linkedin", "social", "b2b"],
    notes: "Use for employer brand, thought leadership, recruiting, and B2B distribution.",
  },
  {
    id: "youtube-channel",
    providerId: "youtube",
    title: "YouTube channel",
    subtitle: "Video publishing, comments, and authority content",
    usage: "social",
    suggestedLabel: "YouTube primary",
    accountHint: "channel handle or channel id",
    scopes: ["youtube.readonly", "youtube.upload", "youtube.force-ssl"],
    channels: ["youtube", "video", "education"],
    notes: "Good default for Kurs.ing, TRT.ge, Lovkode, and AI Influencer company media ops.",
  },
  {
    id: "tiktok-brand",
    providerId: "tiktok",
    title: "TikTok brand account",
    subtitle: "Short-form publishing and trend-adaptive content",
    usage: "social",
    suggestedLabel: "TikTok primary",
    accountHint: "@companyhandle",
    scopes: ["user.info.basic", "video.publish", "video.list"],
    channels: ["tiktok", "social", "short-form"],
    notes: "Treat this as distinct from Instagram even if one team manages both.",
  },
  {
    id: "github-org",
    providerId: "github",
    title: "GitHub org or repo access",
    subtitle: "Code, issues, PRs, and release automation",
    usage: "other",
    suggestedLabel: "GitHub engineering",
    accountHint: "org/repo or username",
    scopes: ["repo", "workflow", "read:user"],
    channels: ["engineering", "repo", "release"],
    notes: "Use a separate company record per org or operational surface. Keep PAT/app secrets in company secrets.",
  },
  {
    id: "gmail-ops",
    providerId: "gmail",
    title: "Gmail or Google Workspace inbox",
    subtitle: "Support, outreach, onboarding, and operator mailboxes",
    usage: "email",
    suggestedLabel: "Gmail operations",
    accountHint: "name@company.com",
    scopes: ["gmail.readonly", "gmail.send", "gmail.modify"],
    channels: ["email", "ops", "support"],
    notes: "Prefer one mailbox record per purpose if the company uses separate support/outreach inboxes.",
  },
  {
    id: "ga4-property",
    providerId: "google-analytics",
    title: "GA4 property",
    subtitle: "Web and funnel analytics per company",
    usage: "analytics",
    suggestedLabel: "GA4 primary",
    accountHint: "properties/123456789",
    scopes: ["analytics.readonly"],
    channels: ["analytics", "web", "growth"],
    notes: "Keep analytics property mapping per company so dashboards don’t blend unrelated businesses.",
  },
  {
    id: "meta-ads",
    providerId: "meta-ads",
    title: "Meta Ads account",
    subtitle: "Paid social campaigns for Facebook + Instagram",
    usage: "ads",
    suggestedLabel: "Meta Ads",
    accountHint: "act_1234567890",
    scopes: ["ads_management", "ads_read", "business_management"],
    channels: ["ads", "facebook", "instagram"],
    notes: "Separate ad accounts per company wherever possible to preserve billing and reporting boundaries.",
  },
  {
    id: "stripe-billing",
    providerId: "stripe",
    title: "Stripe billing account",
    subtitle: "Payments, subscriptions, invoices, and webhook-based commerce flows",
    usage: "commerce",
    suggestedLabel: "Stripe primary",
    accountHint: "acct_123456789 or Stripe account label",
    scopes: ["read_only", "payment_intents", "customers", "subscriptions", "webhooks"],
    channels: ["billing", "payments", "subscriptions"],
    notes: "Use one company record per billing entity. Keep secret keys and webhook secrets in company secrets.",
  },
  {
    id: "cloudflare-platform",
    providerId: "cloudflare",
    title: "Cloudflare account or zone",
    subtitle: "DNS, Workers, Pages, edge analytics, and deployment control",
    usage: "other",
    suggestedLabel: "Cloudflare platform",
    accountHint: "zone name, account id, or deployment surface",
    scopes: ["zone:read", "workers:write", "account:read", "analytics:read"],
    channels: ["dns", "workers", "pages", "edge"],
    notes: "Good default for EmDash, Kurs.ing, TRT.ge, and platform operations. Keep account token in company secrets.",
  },
  {
    id: "render-service",
    providerId: "render",
    title: "Render service or blueprint",
    subtitle: "Deploys, services, and managed infrastructure control",
    usage: "other",
    suggestedLabel: "Render platform",
    accountHint: "service id, workspace, or blueprint name",
    scopes: ["services:read", "services:write", "blueprints:write"],
    channels: ["deploy", "infra", "backend"],
    notes: "Use when a company runs its own Render services or blueprints.",
  },
  {
    id: "supabase-project",
    providerId: "supabase",
    title: "Supabase project",
    subtitle: "Database, auth, storage, and API state per company app",
    usage: "other",
    suggestedLabel: "Supabase primary",
    accountHint: "project ref or project url",
    scopes: ["project:read", "service_role", "storage:write"],
    channels: ["database", "auth", "storage"],
    notes: "Keep the service-role secret in company secrets and bind one record per product backend.",
  },
  {
    id: "clerk-instance",
    providerId: "clerk",
    title: "Clerk auth instance",
    subtitle: "User, session, webhook, and auth-admin control",
    usage: "other",
    suggestedLabel: "Clerk auth",
    accountHint: "instance slug or dashboard url",
    scopes: ["users:read", "users:write", "webhooks"],
    channels: ["auth", "users", "identity"],
    notes: "Useful for products that run Clerk as the live auth control plane.",
  },
  {
    id: "convex-deployment",
    providerId: "convex",
    title: "Convex deployment",
    subtitle: "Functions, env vars, and hosted app data runtime",
    usage: "other",
    suggestedLabel: "Convex primary",
    accountHint: "deployment name or url",
    scopes: ["deployment:read", "deployment:write", "data:write"],
    channels: ["functions", "backend", "realtime"],
    notes: "Good default for Gatareba and other Convex-backed products.",
  },
  {
    id: "posthog-project",
    providerId: "posthog",
    title: "PostHog project",
    subtitle: "Product analytics, feature flags, and event insight surface",
    usage: "analytics",
    suggestedLabel: "PostHog primary",
    accountHint: "project id or project name",
    scopes: ["project:read", "project:write"],
    channels: ["analytics", "product", "feature-flags"],
    notes: "Use one project record per company product surface to keep events and feature flags isolated.",
  },
];

export const CONNECTOR_QUICK_START_BUNDLES: ConnectorQuickStartBundle[] = [
  {
    id: "social-brand-stack",
    title: "Social brand stack",
    subtitle: "Instagram, X, Facebook, LinkedIn, YouTube, and TikTok for one company",
    quickStartIds: ["instagram-brand", "facebook-page", "x-brand", "linkedin-company", "youtube-channel", "tiktok-brand"],
  },
  {
    id: "engineering-stack",
    title: "Engineering stack",
    subtitle: "GitHub plus company email for repo, release, and operator flows",
    quickStartIds: ["github-org", "gmail-ops"],
  },
  {
    id: "growth-stack",
    title: "Growth stack",
    subtitle: "Analytics and ads surfaces with clear company boundaries",
    quickStartIds: ["ga4-property", "posthog-project", "meta-ads", "gmail-ops", "stripe-billing"],
  },
  {
    id: "platform-stack",
    title: "Platform stack",
    subtitle: "Edge, deployment, and infrastructure accounts for one company",
    quickStartIds: ["cloudflare-platform", "render-service", "github-org"],
  },
  {
    id: "app-backend-stack",
    title: "App backend stack",
    subtitle: "Auth, database, realtime, and product telemetry surfaces",
    quickStartIds: ["supabase-project", "clerk-instance", "convex-deployment", "posthog-project"],
  },
  {
    id: "commerce-stack",
    title: "Commerce stack",
    subtitle: "Payments, billing analytics, and operator mail for customer revenue flows",
    quickStartIds: ["stripe-billing", "ga4-property", "posthog-project", "gmail-ops"],
  },
];

export function listConnectorQuickStarts() {
  return CONNECTOR_QUICK_STARTS;
}

export function listConnectorQuickStartBundles() {
  return CONNECTOR_QUICK_START_BUNDLES.map((bundle) => ({
    ...bundle,
    quickStarts: bundle.quickStartIds
      .map((id) => CONNECTOR_QUICK_STARTS.find((entry) => entry.id === id))
      .filter((entry): entry is ConnectorQuickStart => Boolean(entry)),
  }));
}

export function getConnectorQuickStart(id: string) {
  return CONNECTOR_QUICK_STARTS.find((entry) => entry.id === id);
}
