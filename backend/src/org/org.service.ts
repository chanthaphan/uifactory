import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

export interface OrgMember {
  email: string;
  name: string;
  source: 'graph' | 'platform' | 'mock';
}

// Fake colleagues used in dev mode so the share picker is populated without a real tenant.
const MOCK_ORG: OrgMember[] = [
  { email: 'priya.nair@contoso.com', name: 'Priya Nair', source: 'mock' },
  { email: 'tom.becker@contoso.com', name: 'Tom Becker', source: 'mock' },
  { email: 'sara.lopez@contoso.com', name: 'Sara Lopez', source: 'mock' },
  { email: 'kenji.watanabe@contoso.com', name: 'Kenji Watanabe', source: 'mock' },
  { email: 'amelia.frost@contoso.com', name: 'Amelia Frost', source: 'mock' },
];

@Injectable()
export class OrgService {
  private readonly logger = new Logger(OrgService.name);
  private graphToken?: { value: string; expiresAt: number };

  constructor(private readonly prisma: PrismaService) {}

  isLive(): boolean {
    return Boolean(process.env.AZURE_AD_TENANT_ID && process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET);
  }

  async searchUsers(q: string): Promise<OrgMember[]> {
    if (this.isLive()) {
      try {
        return await this.graphSearch(q);
      } catch (e) {
        this.logger.warn(`Graph search failed, using local fallback: ${(e as Error).message}`);
      }
    }
    return this.localSearch(q);
  }

  /** Dev/fallback: platform users (real logins) + mock colleagues, filtered by query. */
  private async localSearch(q: string): Promise<OrgMember[]> {
    const users = await this.prisma.user.findMany({ take: 100 });
    const platform: OrgMember[] = users.map((u) => ({ email: u.email, name: u.name, source: 'platform' }));
    const seen = new Set(platform.map((p) => p.email.toLowerCase()));
    const combined = [...platform, ...MOCK_ORG.filter((m) => !seen.has(m.email.toLowerCase()))];
    const term = q.trim().toLowerCase();
    const filtered = term
      ? combined.filter((m) => m.name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term))
      : combined;
    return filtered.slice(0, 20);
  }

  private async getGraphToken(): Promise<string> {
    if (this.graphToken && this.graphToken.expiresAt > Date.now() + 60_000) return this.graphToken.value;
    const tenant = process.env.AZURE_AD_TENANT_ID;
    const body = new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    });
    const res = await axios.post(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    this.graphToken = { value: res.data.access_token, expiresAt: Date.now() + res.data.expires_in * 1000 };
    return this.graphToken.value;
  }

  private async graphSearch(q: string): Promise<OrgMember[]> {
    const token = await this.getGraphToken();
    const term = q.replace(/'/g, "''");
    const filter = term
      ? `?$filter=startswith(displayName,'${term}') or startswith(mail,'${term}')&$top=20`
      : '?$top=20';
    const res = await axios.get(`https://graph.microsoft.com/v1.0/users${filter}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    return (res.data.value as Array<{ displayName: string; mail?: string; userPrincipalName: string }>).map((u) => ({
      name: u.displayName,
      email: (u.mail || u.userPrincipalName).toLowerCase(),
      source: 'graph' as const,
    }));
  }
}
