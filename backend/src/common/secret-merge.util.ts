/**
 * Merge an incoming (possibly redacted) config over the stored one, preserving secrets the editor
 * left untouched. A value that is blank or still carries the redaction marker ("***") keeps the
 * stored value; everything else is taken from the incoming config. Headers are merged per-key.
 */
export function mergeConfigPreservingSecrets(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const unchanged = (v: unknown) => typeof v === 'string' && (v.trim() === '' || v.includes('***'));
  const result: Record<string, unknown> = { ...incoming };
  for (const key of Object.keys(incoming)) {
    if (key === 'headers') continue;
    if (unchanged(incoming[key]) && key in existing) result[key] = existing[key];
  }
  if (incoming.headers && typeof incoming.headers === 'object') {
    const inH = { ...(incoming.headers as Record<string, unknown>) };
    const exH = (existing.headers as Record<string, unknown>) || {};
    for (const h of Object.keys(inH)) {
      if (unchanged(inH[h]) && h in exH) inH[h] = exH[h];
    }
    result.headers = inH;
  }
  return result;
}
