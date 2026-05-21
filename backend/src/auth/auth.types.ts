export type Role = 'admin' | 'member';

/** The authenticated user attached to each request. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  avatarUrl?: string | null;
}

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
}

/** Profile extracted from an identity provider (Azure AD) or dev login. */
export interface OidcProfile {
  email: string;
  name: string;
  oid?: string;
  avatarUrl?: string;
}

export const SESSION_COOKIE = 'uifactory_session';
export const OIDC_STATE_COOKIE = 'uifactory_oidc_state';
