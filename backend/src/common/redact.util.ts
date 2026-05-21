const SENSITIVE_KEYS = ['connectionString', 'password', 'authorization', 'apiKey', 'token'];

/** Mask secret-bearing fields (and Authorization/key/token headers) in a data-source/connector config. */
export function redactConfig(config: Record<string, unknown>): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...config };
  for (const key of Object.keys(clone)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase() === s.toLowerCase()) && typeof clone[key] === 'string') {
      const val = clone[key] as string;
      clone[key] = val.length > 6 ? `${val.slice(0, 3)}***${val.slice(-2)}` : '***';
    }
  }
  if (clone.headers && typeof clone.headers === 'object') {
    const headers = { ...(clone.headers as Record<string, string>) };
    for (const h of Object.keys(headers)) {
      if (h.toLowerCase() === 'authorization' || h.toLowerCase().includes('key') || h.toLowerCase().includes('token')) {
        headers[h] = '***';
      }
    }
    clone.headers = headers;
  }
  return clone;
}
