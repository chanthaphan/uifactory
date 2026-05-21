import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard. Rejects URLs that resolve to private / loopback / link-local / reserved ranges,
 * so user-supplied REST/agent/LLM endpoints can't reach internal services or cloud metadata.
 * Bypass with ALLOW_PRIVATE_NETWORK=true, or allowlist hosts via OUTBOUND_ALLOWLIST.
 */
function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local + 169.254.169.254 metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const ip6 = ip.toLowerCase();
    if (ip6 === '::1' || ip6 === '::') return true;
    if (ip6.startsWith('fe80') || ip6.startsWith('fc') || ip6.startsWith('fd')) return true;
    if (ip6.startsWith('::ffff:')) return isPrivateIp(ip6.slice(7)); // IPv4-mapped
    return false;
  }
  return false;
}

export async function assertSafeUrl(urlStr: string): Promise<void> {
  if (process.env.ALLOW_PRIVATE_NETWORK === 'true') return;

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new BadRequestException(`Invalid URL: ${urlStr}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Only http(s) URLs are allowed');
  }

  const allowlist = (process.env.OUTBOUND_ALLOWLIST || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.includes(url.hostname.toLowerCase())) return;

  const host = url.hostname;
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      const results = await lookup(host, { all: true });
      addresses = results.map((r) => r.address);
    } catch {
      throw new BadRequestException(`Could not resolve host: ${host}`);
    }
  }
  if (addresses.some(isPrivateIp)) {
    throw new BadRequestException(
      `Refusing to connect to a private/reserved address (${host}). Set ALLOW_PRIVATE_NETWORK=true to override in trusted environments.`,
    );
  }
}
