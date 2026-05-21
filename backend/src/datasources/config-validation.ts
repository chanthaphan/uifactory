import { z } from 'zod';
import { DataSourceType } from '../execution/execution.types';

/** A non-empty string that parses as a URL. Masked secrets never appear in URL fields. */
const urlString = z
  .string()
  .trim()
  .min(1, 'is required')
  .refine((v) => {
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  }, 'must be a valid URL');

const headers = z.record(z.string(), z.string()).optional();

/**
 * Per-type config schemas. Used only to *validate* required fields — callers store the original
 * config object, so unknown keys are preserved (zod silently ignores extras here).
 */
export const dataSourceConfigSchemas: Record<DataSourceType, z.ZodTypeAny> = {
  REST: z.object({
    baseUrl: urlString,
    headers,
    forwardIdentity: z.boolean().optional(),
    identityHeader: z.string().optional(),
  }),
  POSTGRES: z.object({ connectionString: z.string().trim().min(1, 'is required') }),
  SQLITE: z.object({ file: z.string().trim().min(1, 'is required') }),
  MSGRAPH: z.object({}),
  AGENT: z.object({ url: urlString, apiKey: z.string().optional(), authHeader: z.string().optional(), extraHeaders: headers }),
};

/** Returns a human-readable error message when the config is invalid for its type, else null. */
export function validateDataSourceConfig(type: DataSourceType, config: unknown): string | null {
  const schema = dataSourceConfigSchemas[type];
  if (!schema) return `Unsupported data source type: ${type}`;
  const result = schema.safeParse(config ?? {});
  if (result.success) return null;
  const issue = result.error.issues[0];
  const field = issue?.path?.length ? issue.path.join('.') : 'config';
  return `Invalid ${type} config — ${field}: ${issue?.message || 'is invalid'}`;
}
