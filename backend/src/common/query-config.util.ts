/** True when a query config mutates data: non-SELECT/WITH/PRAGMA SQL, or a non-GET REST method. */
export function isMutationConfig(config: { sql?: string; method?: string }): boolean {
  if (typeof config.sql === 'string') return !/^\s*(select|with|pragma)/i.test(config.sql);
  return (config.method || 'GET').toUpperCase() !== 'GET';
}

/** True when a data source is allowed by a page's connector scope (empty/undefined scope = all). */
export function dataSourceInScope(scope: string[] | undefined, dataSourceId: string | undefined): boolean {
  if (!scope || scope.length === 0) return true;
  return !!dataSourceId && scope.includes(dataSourceId);
}
