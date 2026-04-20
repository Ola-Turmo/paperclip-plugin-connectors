/**
 * Provider Capability Registry
 * 
 * Defines explicit capability descriptors for connector providers covering:
 * - Auth model and requirements
 * - Event/callback model
 * - Supported scopes and permissions
 * - Write boundaries and limitations
 * - Rate limit characteristics
 * 
 * This module implements UOS-FOUND-CONN-001: Connector onboarding exposes explicit 
 * provider capability boundaries.
 */

export type AuthModel = 
  | "oauth2"           // Standard OAuth 2.0 flow
  | "oauth2_client_credentials" // Client credentials grant
  | "service_account"  // Service account / signed JWT flow
  | "api_key"          // API key authentication
  | "bearer_token"     // Bearer token authentication
  | "basic_auth"       // Basic username/password
  | "webhook_secret"   // Webhook signature verification
  | "session_cookie"   // Session-based authentication
  | "saml"             // SAML-based SSO
  | "oidc";            // OpenID Connect

export type EventModel =
  | "webhook"          // Server pushes events via webhooks
  | "polling"          // Client polls for changes
  | "websocket"        // Real-time bidirectional
  | "streaming"        // Server-sent events / streaming
  | "batch";           // Batch export/import

export type WriteBoundary =
  | "read_only"        // No write operations supported
  | "own_resources"    // Can only manage own resources
  | "all_resources"    // Can manage all resources (admin)
  | "limited_resources"; // Limited to specific resource types

export interface RateLimitInfo {
  requestsPerMinute: number;
  burstLimit?: number;
  retryAfterHeader?: string;
  backoffStrategy?: "fixed" | "exponential" | "linear";
}

export interface ScopeMatrix {
  scopes: Record<string, {
    description: string;
    required: boolean;
    sensitive: boolean;
    expiresInSeconds?: number;
  }>;
  optionalScopes?: string[];
}

export interface ProviderCapabilityDescriptor {
  /** Unique provider identifier */
  providerId: string;
  
  /** Human-readable provider name */
  displayName: string;
  
  /** Provider family/category */
  category: "communication" | "productivity" | "social" | "analytics" | 
           "commerce" | "development" | "marketing" | "data" | "other";
  
  /** Authentication model used by this provider */
  authModel: AuthModel[];
  
  /** Event delivery model */
  eventModel: EventModel;
  
  /** OAuth endpoints if applicable */
  authEndpoints?: {
    authorization: string;
    token: string;
    revocation?: string;
    refresh?: string;
  };
  
  /** API base URL */
  apiBaseUrl: string;
  
  /** Scopes supported by this provider */
  scopeMatrix: ScopeMatrix;
  
  /** Write permission boundaries */
  writeBoundary: WriteBoundary;
  
  /** Rate limit characteristics */
  rateLimit: RateLimitInfo;
  
  /** Whether token refresh is supported */
  supportsTokenRefresh: boolean;
  
  /** Token expiration typical duration */
  typicalTokenLifetimeSeconds?: number;
  
  /** Webhook secret header name for signature verification */
  webhookSecretHeader?: string;
  
  /** Callback URL requirements */
  callbackRequirements?: {
    requiresHTTPS: boolean;
    allowedPorts?: number[];
    allowedPaths?: string[];
  };
  
  /** Retry behavior for failed operations */
  retryPolicy?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  
  /** Whether this provider is certified for production use */
  certified: boolean;
  
  /** Certification details if applicable */
  certificationInfo?: {
    certifiedAt: string;
    certifiedBy: string;
    coverageScope: string[];
    fallbackPathsAvailable: boolean;
    auditLoggingAvailable: boolean;
  };
  
  /** Deprecation or end-of-life information */
  lifecycleState?: "beta" | "stable" | "deprecated" | "eol";
  
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Get the complete capability descriptor for a provider
 */
export function getProviderCapability(providerId: string): ProviderCapabilityDescriptor | undefined {
  return PROVIDER_CAPABILITIES[providerId];
}

/**
 * List all registered providers
 */
export function listProviders(): string[] {
  return Object.keys(PROVIDER_CAPABILITIES);
}

/**
 * List providers by category
 */
export function listProvidersByCategory(category: ProviderCapabilityDescriptor["category"]): ProviderCapabilityDescriptor[] {
  return Object.values(PROVIDER_CAPABILITIES).filter(p => p.category === category);
}

/**
 * List only certified production-ready providers
 */
export function listCertifiedProviders(): ProviderCapabilityDescriptor[] {
  return Object.values(PROVIDER_CAPABILITIES).filter(p => p.certified);
}

/**
 * Validate that a provider has required capabilities for a given operation
 */
export function validateProviderCapabilities(
  providerId: string, 
  requiredCapabilities: Partial<Record<keyof ProviderCapabilityDescriptor, unknown>>
): { valid: boolean; missingCapabilities: string[] } {
  const provider = PROVIDER_CAPABILITIES[providerId];
  if (!provider) {
    return { valid: false, missingCapabilities: ["Provider not found"] };
  }
  
  const missingCapabilities: string[] = [];
  
  for (const [key, required] of Object.entries(requiredCapabilities)) {
    const providerValue = provider[key as keyof ProviderCapabilityDescriptor];
    if (providerValue === undefined || providerValue === null) {
      missingCapabilities.push(key);
    }
  }
  
  return {
    valid: missingCapabilities.length === 0,
    missingCapabilities
  };
}

/**
 * Generate a human-readable capability summary for operator display
 */
export function generateCapabilitySummary(providerId: string): string | undefined {
  const provider = PROVIDER_CAPABILITIES[providerId];
  if (!provider) return undefined;
  
  const lines = [
    `Provider: ${provider.displayName}`,
    `Category: ${provider.category}`,
    `Auth Model: ${provider.authModel.join(", ")}`,
    `Event Model: ${provider.eventModel}`,
    `Write Boundary: ${provider.writeBoundary}`,
    `Rate Limit: ${provider.rateLimit.requestsPerMinute} req/min`,
    `Token Refresh: ${provider.supportsTokenRefresh ? "Supported" : "Not supported"}`,
    `Certified: ${provider.certified ? "Yes" : "No"}`,
    `Lifecycle: ${provider.lifecycleState ?? "stable"}`,
  ];
  
  if (provider.certificationInfo) {
    lines.push(`Certification: ${provider.certificationInfo.coverageScope.join(", ")}`);
    lines.push(`Fallback Paths: ${provider.certificationInfo.fallbackPathsAvailable ? "Available" : "Not available"}`);
    lines.push(`Audit Logging: ${provider.certificationInfo.auditLoggingAvailable ? "Available" : "Not available"}`);
  }
  
  return lines.join("\n");
}

// Registry of known provider capabilities
const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilityDescriptor> = {
  "slack": {
    providerId: "slack",
    displayName: "Slack",
    category: "communication",
    authModel: ["oauth2"],
    eventModel: "webhook",
    authEndpoints: {
      authorization: "https://slack.com/oauth/v2/authorize",
      token: "https://slack.com/api/oauth.v2.access",
      revocation: "https://slack.com/auth/revoke",
    },
    apiBaseUrl: "https://slack.com/api",
    scopeMatrix: {
      scopes: {
        "channels:read": { description: "Read channel information", required: true, sensitive: false },
        "chat:write": { description: "Send messages", required: true, sensitive: false },
        "files:write": { description: "Upload files", required: false, sensitive: false },
        "users:read": { description: "Read user profiles", required: false, sensitive: true },
        "admin": { description: "Administrative access", required: false, sensitive: true },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 100,
      burstLimit: 200,
      retryAfterHeader: "Retry-After",
      backoffStrategy: "exponential"
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 86400, // 24 hours
    webhookSecretHeader: "X-Slack-Signature",
    callbackRequirements: {
      requiresHTTPS: true,
      allowedPorts: [443]
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2
    },
    certified: true,
    certificationInfo: {
      certifiedAt: "2026-01-15T00:00:00Z",
      certifiedBy: "UOS Platform Team",
      coverageScope: ["messaging", "channels", "files", "users"],
      fallbackPathsAvailable: true,
      auditLoggingAvailable: true
    },
    lifecycleState: "stable"
  },
  
  "github": {
    providerId: "github",
    displayName: "GitHub",
    category: "development",
    authModel: ["oauth2", "bearer_token", "webhook_secret"],
    eventModel: "webhook",
    authEndpoints: {
      authorization: "https://github.com/login/oauth/authorize",
      token: "https://github.com/login/oauth/access_token",
      revocation: "https://api.github.com/applications/{client_id}/token",
    },
    apiBaseUrl: "https://api.github.com",
    scopeMatrix: {
      scopes: {
        "repo": { description: "Full repository access", required: false, sensitive: true },
        "read:user": { description: "Read user profile", required: true, sensitive: true },
        "user:email": { description: "Read user emails", required: false, sensitive: true },
        "notifications": { description: "Access notifications", required: false, sensitive: false },
        "workflow": { description: "Update GitHub Actions workflows", required: false, sensitive: true },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 5000,
      burstLimit: undefined,
      retryAfterHeader: "X-RateLimit-Reset",
      backoffStrategy: "fixed"
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 3600, // 1 hour for personal access tokens
    webhookSecretHeader: "X-Hub-Signature-256",
    callbackRequirements: {
      requiresHTTPS: true
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 1.5
    },
    certified: true,
    certificationInfo: {
      certifiedAt: "2026-01-20T00:00:00Z",
      certifiedBy: "UOS Platform Team",
      coverageScope: ["repositories", "issues", "pull_requests", "workflows", "users"],
      fallbackPathsAvailable: true,
      auditLoggingAvailable: true
    },
    lifecycleState: "stable"
  },
  
  "x": {
    providerId: "x",
    displayName: "X / Twitter",
    category: "social",
    authModel: ["oauth2", "bearer_token"],
    eventModel: "polling",
    authEndpoints: {
      authorization: "https://twitter.com/i/oauth2/authorize",
      token: "https://api.x.com/2/oauth2/token",
      refresh: "https://api.x.com/2/oauth2/token",
    },
    apiBaseUrl: "https://api.x.com/2",
    scopeMatrix: {
      scopes: {
        "tweet.read": { description: "Read tweets", required: true, sensitive: false },
        "tweet.write": { description: "Publish tweets", required: false, sensitive: false },
        "users.read": { description: "Read profile information", required: true, sensitive: false },
        "offline.access": { description: "Refresh tokens", required: false, sensitive: true },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 60,
      retryAfterHeader: "x-rate-limit-reset",
      backoffStrategy: "fixed",
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 7200,
    callbackRequirements: {
      requiresHTTPS: true,
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
    certified: false,
    lifecycleState: "beta",
  },
  
  "instagram": {
    providerId: "instagram",
    displayName: "Instagram",
    category: "social",
    authModel: ["oauth2"],
    eventModel: "webhook",
    authEndpoints: {
      authorization: "https://www.facebook.com/v22.0/dialog/oauth",
      token: "https://graph.facebook.com/v22.0/oauth/access_token",
    },
    apiBaseUrl: "https://graph.facebook.com/v22.0",
    scopeMatrix: {
      scopes: {
        "instagram_basic": { description: "Read basic profile and media", required: true, sensitive: false },
        "instagram_content_publish": { description: "Publish media", required: false, sensitive: false },
        "pages_manage_metadata": { description: "Manage linked page metadata", required: false, sensitive: true },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 200,
      retryAfterHeader: "x-app-usage",
      backoffStrategy: "exponential",
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 5184000,
    webhookSecretHeader: "X-Hub-Signature-256",
    callbackRequirements: {
      requiresHTTPS: true,
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
    certified: false,
    lifecycleState: "beta",
  },

  "facebook": {
    providerId: "facebook",
    displayName: "Facebook",
    category: "social",
    authModel: ["oauth2"],
    eventModel: "webhook",
    authEndpoints: {
      authorization: "https://www.facebook.com/v22.0/dialog/oauth",
      token: "https://graph.facebook.com/v22.0/oauth/access_token",
    },
    apiBaseUrl: "https://graph.facebook.com/v22.0",
    scopeMatrix: {
      scopes: {
        "pages_show_list": { description: "List managed pages", required: true, sensitive: false },
        "pages_manage_posts": { description: "Publish posts", required: false, sensitive: false },
        "pages_read_engagement": { description: "Read engagement", required: false, sensitive: false },
        "business_management": { description: "Manage business assets", required: false, sensitive: true },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 200,
      retryAfterHeader: "x-app-usage",
      backoffStrategy: "exponential",
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 5184000,
    webhookSecretHeader: "X-Hub-Signature-256",
    callbackRequirements: {
      requiresHTTPS: true,
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
    certified: false,
    lifecycleState: "beta",
  },

  "linkedin": {
    providerId: "linkedin",
    displayName: "LinkedIn",
    category: "social",
    authModel: ["oauth2"],
    eventModel: "polling",
    authEndpoints: {
      authorization: "https://www.linkedin.com/oauth/v2/authorization",
      token: "https://www.linkedin.com/oauth/v2/accessToken",
    },
    apiBaseUrl: "https://api.linkedin.com/v2",
    scopeMatrix: {
      scopes: {
        "r_basicprofile": { description: "Read basic profile", required: true, sensitive: true },
        "r_organization_social": { description: "Read organization social data", required: false, sensitive: false },
        "w_organization_social": { description: "Publish organization posts", required: false, sensitive: false },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 100,
      backoffStrategy: "fixed",
    },
    supportsTokenRefresh: false,
    typicalTokenLifetimeSeconds: 5184000,
    callbackRequirements: {
      requiresHTTPS: true,
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
    certified: false,
    lifecycleState: "beta",
  },

  "youtube": {
    providerId: "youtube",
    displayName: "YouTube",
    category: "social",
    authModel: ["oauth2"],
    eventModel: "polling",
    authEndpoints: {
      authorization: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      refresh: "https://oauth2.googleapis.com/token",
    },
    apiBaseUrl: "https://www.googleapis.com/youtube/v3",
    scopeMatrix: {
      scopes: {
        "youtube.readonly": { description: "Read channel and video data", required: true, sensitive: false },
        "youtube.upload": { description: "Upload videos", required: false, sensitive: false },
        "youtube.force-ssl": { description: "Manage comments and moderation", required: false, sensitive: true },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 100,
      backoffStrategy: "fixed",
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 3600,
    callbackRequirements: {
      requiresHTTPS: true,
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
    certified: false,
    lifecycleState: "beta",
  },

  "tiktok": {
    providerId: "tiktok",
    displayName: "TikTok",
    category: "social",
    authModel: ["oauth2"],
    eventModel: "polling",
    authEndpoints: {
      authorization: "https://www.tiktok.com/v2/auth/authorize/",
      token: "https://open.tiktokapis.com/v2/oauth/token/",
      refresh: "https://open.tiktokapis.com/v2/oauth/token/",
    },
    apiBaseUrl: "https://open.tiktokapis.com/v2",
    scopeMatrix: {
      scopes: {
        "user.info.basic": { description: "Read basic user profile", required: true, sensitive: false },
        "video.list": { description: "Read published videos", required: false, sensitive: false },
        "video.publish": { description: "Publish videos", required: false, sensitive: false },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 100,
      backoffStrategy: "fixed",
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 86400,
    callbackRequirements: {
      requiresHTTPS: true,
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
    certified: false,
    lifecycleState: "beta",
  },

  "gmail": {
    providerId: "gmail",
    displayName: "Gmail",
    category: "communication",
    authModel: ["oauth2"],
    eventModel: "polling",
    authEndpoints: {
      authorization: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      refresh: "https://oauth2.googleapis.com/token",
    },
    apiBaseUrl: "https://gmail.googleapis.com/gmail/v1",
    scopeMatrix: {
      scopes: {
        "gmail.readonly": { description: "Read mail", required: true, sensitive: true },
        "gmail.send": { description: "Send mail", required: false, sensitive: true },
        "gmail.modify": { description: "Modify labels and state", required: false, sensitive: true },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 250,
      backoffStrategy: "exponential",
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 3600,
    callbackRequirements: {
      requiresHTTPS: true,
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
    certified: false,
    lifecycleState: "beta",
  },

  "google-analytics": {
    providerId: "google-analytics",
    displayName: "Google Analytics",
    category: "analytics",
    authModel: ["oauth2", "service_account"],
    eventModel: "batch",
    authEndpoints: {
      authorization: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      refresh: "https://oauth2.googleapis.com/token",
    },
    apiBaseUrl: "https://analyticsdata.googleapis.com/v1beta",
    scopeMatrix: {
      scopes: {
        "analytics.readonly": { description: "Read analytics properties", required: true, sensitive: true },
      }
    },
    writeBoundary: "read_only",
    rateLimit: {
      requestsPerMinute: 120,
      backoffStrategy: "fixed",
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 3600,
    callbackRequirements: {
      requiresHTTPS: true,
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
    certified: false,
    lifecycleState: "beta",
  },

  "meta-ads": {
    providerId: "meta-ads",
    displayName: "Meta Ads",
    category: "marketing",
    authModel: ["oauth2"],
    eventModel: "batch",
    authEndpoints: {
      authorization: "https://www.facebook.com/v22.0/dialog/oauth",
      token: "https://graph.facebook.com/v22.0/oauth/access_token",
    },
    apiBaseUrl: "https://graph.facebook.com/v22.0",
    scopeMatrix: {
      scopes: {
        "ads_read": { description: "Read ad account data", required: true, sensitive: true },
        "ads_management": { description: "Manage campaigns", required: false, sensitive: true },
        "business_management": { description: "Manage business assets", required: false, sensitive: true },
      }
    },
    writeBoundary: "limited_resources",
    rateLimit: {
      requestsPerMinute: 200,
      retryAfterHeader: "x-business-use-case-usage",
      backoffStrategy: "exponential",
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 5184000,
    callbackRequirements: {
      requiresHTTPS: true,
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
    certified: false,
    lifecycleState: "beta",
  },
  
  "discord": {
    providerId: "discord",
    displayName: "Discord",
    category: "communication",
    authModel: ["oauth2"],
    eventModel: "webhook",
    authEndpoints: {
      authorization: "https://discord.com/oauth2/authorize",
      token: "https://discord.com/api/oauth2/token",
      revocation: "https://discord.com/api/oauth2/token/revoke",
    },
    apiBaseUrl: "https://discord.com/api/v10",
    scopeMatrix: {
      scopes: {
        "identify": { description: "Read user profile", required: true, sensitive: true },
        "guilds": { description: "Read guild information", required: false, sensitive: false },
        "guilds.members.read": { description: "Read guild member info", required: false, sensitive: true },
        "messages.write": { description: "Send messages", required: false, sensitive: false },
        "webhook.incoming": { description: "Use webhooks", required: true, sensitive: false },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 120,
      burstLimit: undefined,
      retryAfterHeader: "Retry-After",
      backoffStrategy: "exponential"
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 604800, // 7 days
    webhookSecretHeader: "X-Discord-Signature",
    callbackRequirements: {
      requiresHTTPS: true
    },
    retryPolicy: {
      maxRetries: 5,
      initialDelayMs: 5000,
      maxDelayMs: 60000,
      backoffMultiplier: 1.5
    },
    certified: false, // Not yet certified
    lifecycleState: "beta"
  },
  
  "notion": {
    providerId: "notion",
    displayName: "Notion",
    category: "productivity",
    authModel: ["oauth2"],
    eventModel: "polling",
    authEndpoints: {
      authorization: "https://api.notion.com/v1/oauth/authorize",
      token: "https://api.notion.com/v1/oauth/token",
    },
    apiBaseUrl: "https://api.notion.com/v1",
    scopeMatrix: {
      scopes: {
        "read_content": { description: "Read content", required: true, sensitive: false },
        "write_content": { description: "Update content", required: false, sensitive: false },
        "user:email": { description: "Read user email", required: false, sensitive: true },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 60,
      burstLimit: undefined,
      retryAfterHeader: "Retry-After",
      backoffStrategy: "exponential"
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 2592000, // 30 days
    callbackRequirements: {
      requiresHTTPS: true
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2
    },
    certified: false,
    lifecycleState: "beta"
  },
  
  "hubspot": {
    providerId: "hubspot",
    displayName: "HubSpot",
    category: "marketing",
    authModel: ["oauth2", "api_key"],
    eventModel: "webhook",
    authEndpoints: {
      authorization: "https://app.hubspot.com/oauth/authorize",
      token: "https://api.hubapi.com/oauth/v1/token",
      refresh: "https://api.hubapi.com/oauth/v1/token",
    },
    apiBaseUrl: "https://api.hubapi.com",
    scopeMatrix: {
      scopes: {
        "crm.objects.contacts.read": { description: "Read contacts", required: true, sensitive: true },
        "crm.objects.contacts.write": { description: "Write contacts", required: false, sensitive: true },
        "crm.objects.companies.read": { description: "Read companies", required: false, sensitive: true },
        "forms": { description: "Manage forms", required: false, sensitive: false },
        "email": { description: "Send emails", required: false, sensitive: true },
      }
    },
    writeBoundary: "limited_resources",
    rateLimit: {
      requestsPerMinute: 110,
      burstLimit: 130,
      retryAfterHeader: "X-HubSpot-RateLimit-Remaining",
      backoffStrategy: "linear"
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 1800, // 30 minutes
    webhookSecretHeader: "X-HubSpot-Signature",
    callbackRequirements: {
      requiresHTTPS: true
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2
    },
    certified: true,
    certificationInfo: {
      certifiedAt: "2026-02-01T00:00:00Z",
      certifiedBy: "UOS Platform Team",
      coverageScope: ["contacts", "companies", "deals", "forms", "email"],
      fallbackPathsAvailable: true,
      auditLoggingAvailable: true
    },
    lifecycleState: "stable"
  },
  
  "stripe": {
    providerId: "stripe",
    displayName: "Stripe",
    category: "commerce",
    authModel: ["bearer_token", "webhook_secret"],
    eventModel: "webhook",
    apiBaseUrl: "https://api.stripe.com/v1",
    scopeMatrix: {
      scopes: {
        "read_only": { description: "Read access to payment data", required: true, sensitive: true },
        "payment_intents": { description: "Manage payment intents", required: false, sensitive: true },
        "customers": { description: "Manage customers", required: false, sensitive: true },
        "subscriptions": { description: "Manage subscriptions", required: false, sensitive: true },
        "webhooks": { description: "Receive webhook events", required: true, sensitive: false },
      }
    },
    writeBoundary: "all_resources",
    rateLimit: {
      requestsPerMinute: 500,
      burstLimit: undefined,
      retryAfterHeader: undefined,
      backoffStrategy: "exponential"
    },
    supportsTokenRefresh: false,
    webhookSecretHeader: "Stripe-Signature",
    callbackRequirements: {
      requiresHTTPS: true,
      allowedPorts: [443]
    },
    retryPolicy: {
      maxRetries: 2,
      initialDelayMs: 5000,
      maxDelayMs: 30000,
      backoffMultiplier: 2
    },
    certified: true,
    certificationInfo: {
      certifiedAt: "2026-01-25T00:00:00Z",
      certifiedBy: "UOS Platform Team",
      coverageScope: ["payments", "customers", "subscriptions", "invoices", "webhooks"],
      fallbackPathsAvailable: true,
      auditLoggingAvailable: true
    },
    lifecycleState: "stable"
  },
  
  "jira": {
    providerId: "jira",
    displayName: "Jira",
    category: "productivity",
    authModel: ["basic_auth", "bearer_token", "oauth2"],
    eventModel: "webhook",
    apiBaseUrl: "https://your-domain.atlassian.com/rest/api/3",
    scopeMatrix: {
      scopes: {
        "read:jira-work": { description: "Read Jira work", required: true, sensitive: false },
        "write:jira-work": { description: "Write Jira work", required: false, sensitive: false },
        "manage:jira-project": { description: "Manage projects", required: false, sensitive: true },
        "admin:jira": { description: "Jira admin", required: false, sensitive: true },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 100,
      burstLimit: undefined,
      retryAfterHeader: "X-RateLimit-Reset",
      backoffStrategy: "fixed"
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 3600,
    webhookSecretHeader: "X-Atlassian-Webhook-Signature",
    callbackRequirements: {
      requiresHTTPS: true
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2
    },
    certified: true,
    certificationInfo: {
      certifiedAt: "2026-02-10T00:00:00Z",
      certifiedBy: "UOS Platform Team",
      coverageScope: ["issues", "projects", "workflows", "comments"],
      fallbackPathsAvailable: true,
      auditLoggingAvailable: true
    },
    lifecycleState: "stable"
  },
  
  "linear": {
    providerId: "linear",
    displayName: "Linear",
    category: "productivity",
    authModel: ["oauth2", "api_key"],
    eventModel: "webhook",
    authEndpoints: {
      authorization: "https://linear.app/oauth/authorize",
      token: "https://api.linear.app/oauth/token",
    },
    apiBaseUrl: "https://api.linear.app/graphql",
    scopeMatrix: {
      scopes: {
        "read": { description: "Read access", required: true, sensitive: false },
        "write": { description: "Write access", required: false, sensitive: false },
        "admin": { description: "Admin access", required: false, sensitive: true },
      }
    },
    writeBoundary: "own_resources",
    rateLimit: {
      requestsPerMinute: 60,
      burstLimit: undefined,
      retryAfterHeader: "Retry-After",
      backoffStrategy: "exponential"
    },
    supportsTokenRefresh: true,
    typicalTokenLifetimeSeconds: 2592000,
    webhookSecretHeader: "Linear-Signature",
    callbackRequirements: {
      requiresHTTPS: true
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2
    },
    certified: false,
    lifecycleState: "beta"
  }
};

export default PROVIDER_CAPABILITIES;
