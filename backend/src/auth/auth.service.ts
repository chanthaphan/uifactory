import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, OidcProfile, Role, SESSION_COOKIE, SessionPayload } from './auth.types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-uifactory-secret';
const SESSION_TTL = '7d';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private jwks?: JwksClient;

  /** Azure mode requires a fully configured app registration; otherwise we run in dev mock mode. */
  isAzure(): boolean {
    return Boolean(
      process.env.AZURE_AD_TENANT_ID &&
        process.env.AZURE_AD_CLIENT_ID &&
        process.env.AZURE_AD_CLIENT_SECRET &&
        process.env.AZURE_AD_REDIRECT_URI,
    );
  }

  mode(): 'azure' | 'dev' {
    return this.isAzure() ? 'azure' : 'dev';
  }

  get cookieName() {
    return SESSION_COOKIE;
  }

  cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  signSession(user: AuthUser): string {
    const payload: SessionPayload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TTL });
  }

  private verifySession(token: string): SessionPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as SessionPayload;
    } catch {
      return null;
    }
  }

  /** Resolve the current user from a session cookie, refreshing role/active from the DB. */
  async userFromToken(token?: string): Promise<AuthUser | null> {
    if (!token) return null;
    const payload = this.verifySession(token);
    if (!payload) return null;
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) return null;
    return this.toAuthUser(user);
  }

  constructor(private readonly prisma: PrismaService) {}

  private toAuthUser(u: {
    id: string;
    email: string;
    name: string;
    role: string;
    active: boolean;
    avatarUrl: string | null;
  }): AuthUser {
    return { id: u.id, email: u.email, name: u.name, role: u.role as Role, active: u.active, avatarUrl: u.avatarUrl };
  }

  /** Find or create a user from an identity profile; bootstrap admins via ADMIN_EMAILS or first-user. */
  async upsertUser(profile: OidcProfile): Promise<AuthUser> {
    const email = profile.email.toLowerCase().trim();
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const existing =
      (profile.oid && (await this.prisma.user.findUnique({ where: { oid: profile.oid } }))) ||
      (await this.prisma.user.findUnique({ where: { email } }));

    if (existing) {
      const data: Record<string, unknown> = { name: profile.name || existing.name };
      if (profile.oid && !existing.oid) data.oid = profile.oid;
      if (profile.avatarUrl) data.avatarUrl = profile.avatarUrl;
      const updated = await this.prisma.user.update({ where: { id: existing.id }, data });
      return this.toAuthUser(updated);
    }

    const userCount = await this.prisma.user.count();
    const role: Role = userCount === 0 || adminEmails.includes(email) ? 'admin' : 'member';
    const created = await this.prisma.user.create({
      data: { email, name: profile.name || email, oid: profile.oid, avatarUrl: profile.avatarUrl, role },
    });
    return this.toAuthUser(created);
  }

  // ---- Dev mock auth ----

  async devUsers() {
    if (this.isAzure()) return [];
    const users = await this.prisma.user.findMany({ orderBy: { role: 'asc' }, take: 50 });
    return users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role }));
  }

  async devLogin(email: string): Promise<AuthUser> {
    if (this.isAzure()) throw new UnauthorizedException('Dev login is disabled when Azure AD is configured');
    const normalized = email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    return this.upsertUser({ email: normalized, name: existing?.name || email.split('@')[0] });
  }

  // ---- Azure AD OIDC (auth code flow) ----

  private authority() {
    return `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`;
  }

  buildAuthorizeUrl(state: string, nonce: string): string {
    const params = new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      response_type: 'code',
      redirect_uri: process.env.AZURE_AD_REDIRECT_URI!,
      response_mode: 'query',
      scope: 'openid profile email',
      state,
      nonce,
    });
    return `${this.authority()}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForIdToken(code: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.AZURE_AD_REDIRECT_URI!,
      scope: 'openid profile email',
    });
    const res = await axios.post(`${this.authority()}/oauth2/v2.0/token`, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    if (!res.data?.id_token) throw new UnauthorizedException('No id_token returned by Azure AD');
    return res.data.id_token as string;
  }

  private getJwks(): JwksClient {
    if (!this.jwks) {
      this.jwks = new JwksClient({ jwksUri: `${this.authority()}/discovery/v2.0/keys`, cache: true, rateLimit: true });
    }
    return this.jwks;
  }

  async verifyIdToken(idToken: string, nonce: string): Promise<OidcProfile> {
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
      throw new UnauthorizedException('Malformed id_token');
    }
    const key = await this.getJwks().getSigningKey(decoded.header.kid);
    const claims = jwt.verify(idToken, key.getPublicKey(), {
      audience: process.env.AZURE_AD_CLIENT_ID,
      algorithms: ['RS256'],
    }) as jwt.JwtPayload;

    if (claims.nonce && claims.nonce !== nonce) throw new UnauthorizedException('Nonce mismatch');

    const email = (claims.email || claims.preferred_username || claims.upn) as string | undefined;
    if (!email) throw new UnauthorizedException('id_token has no email claim');
    return { email, name: (claims.name as string) || email, oid: claims.oid as string };
  }
}
