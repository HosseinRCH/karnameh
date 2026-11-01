import { env } from '../env';

/**
 * Generic OAuth2 (authorization-code) provider config.
 * Providers are only enabled when their client id + secret are set in the
 * environment — so OAuth stays dormant until real credentials are provided.
 */
export interface ProviderConfig {
  id: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
}

const DEFS: Record<string, Omit<ProviderConfig, 'id' | 'clientId' | 'clientSecret'>> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
  },
  microsoft: {
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
    scope: 'openid email profile',
  },
};

export function getProviders(): Record<string, ProviderConfig> {
  const out: Record<string, ProviderConfig> = {};
  for (const [id, def] of Object.entries(DEFS)) {
    const creds = id === 'google' ? env.oauth.google : env.oauth.microsoft;
    if (creds.clientId && creds.clientSecret) {
      out[id] = { id, clientId: creds.clientId, clientSecret: creds.clientSecret, ...def };
    }
  }
  return out;
}

export function redirectUri(provider: string): string {
  return `${env.apiBaseUrl}/auth/oauth/${provider}/callback`;
}

export interface OAuthProfile {
  email: string;
  name: string;
}

/** Exchange the authorization code and fetch the user's profile. */
export async function fetchOAuthProfile(
  provider: ProviderConfig,
  code: string,
): Promise<OAuthProfile> {
  const tokenRes = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      redirect_uri: redirectUri(provider.id),
      grant_type: 'authorization_code',
    }).toString(),
  });
  if (!tokenRes.ok) throw new Error(`token_exchange_failed_${tokenRes.status}`);
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error('missing_access_token');

  const infoRes = await fetch(provider.userInfoUrl, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!infoRes.ok) throw new Error(`userinfo_failed_${infoRes.status}`);
  const info = (await infoRes.json()) as { email?: string; name?: string; preferred_username?: string };
  const email = info.email ?? info.preferred_username;
  if (!email) throw new Error('missing_email');
  return { email, name: info.name ?? email.split('@')[0] };
}

export function buildAuthorizeUrl(provider: ProviderConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: redirectUri(provider.id),
    response_type: 'code',
    scope: provider.scope,
    state,
  });
  return `${provider.authorizeUrl}?${params.toString()}`;
}
