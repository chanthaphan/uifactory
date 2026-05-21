import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { decryptString, encryptString } from '../src/common/crypto.util';
import { normalizeDefinition, parseAiConfig } from '../src/apps/app-defs';

/**
 * One-off migration: app-level "external agent API" connections become AGENT connectors.
 *
 * For every app whose aiConfig.mode is 'agent-api', we:
 *   1. create an AGENT data source from the inline agent config (url/apiKey/authHeader/extraHeaders),
 *   2. point every chat page that has no agent yet at that connector (in both draft + published defs),
 *   3. reset the app's aiConfig to 'platform' (the inline agent endpoint is no longer app-level).
 *
 * Idempotent: already-migrated apps have mode 'platform' and are skipped.
 */
const prisma = new PrismaClient();

function assignAgentToChatPages(defJson: string | null, dataSourceId: string): string | null {
  if (!defJson) return null;
  const def = normalizeDefinition(JSON.parse(defJson));
  let changed = false;
  for (const p of def.pages) {
    if (p.type === 'chat') {
      p.chat = p.chat || {};
      if (!p.chat.agentDataSourceId) {
        p.chat.agentDataSourceId = dataSourceId;
        changed = true;
      }
    }
  }
  return changed ? JSON.stringify(def) : null;
}

async function main() {
  const apps = await prisma.app.findMany();
  let migrated = 0;

  for (const app of apps) {
    const cfg = parseAiConfig(app.aiConfig ? decryptString(app.aiConfig) : null);
    if (cfg.mode !== 'agent-api' || !cfg.agent?.url) continue;

    const dsConfig: Record<string, unknown> = { url: cfg.agent.url };
    if (cfg.agent.apiKey) dsConfig.apiKey = cfg.agent.apiKey;
    if (cfg.agent.authHeader) dsConfig.authHeader = cfg.agent.authHeader;
    if (cfg.agent.extraHeaders) dsConfig.extraHeaders = cfg.agent.extraHeaders;

    const ds = await prisma.dataSource.create({
      data: { name: 'Agent (migrated)', type: 'AGENT', config: encryptString(JSON.stringify(dsConfig)), appId: app.id },
    });

    const draft = assignAgentToChatPages(app.definition, ds.id);
    const published = assignAgentToChatPages(app.publishedDefinition, ds.id);

    await prisma.app.update({
      where: { id: app.id },
      data: {
        aiConfig: encryptString(JSON.stringify({ mode: 'platform' })),
        ...(draft ? { definition: draft } : {}),
        ...(published ? { publishedDefinition: published } : {}),
      },
    });

    migrated++;
    console.log(`Migrated "${app.name}" (${app.id}) → AGENT connector ${ds.id} (draft chat pages: ${draft ? 'updated' : 'none'}, published: ${published ? 'updated' : 'none'})`);
  }

  console.log(`Done. Migrated ${migrated} app(s) with an app-level agent connection.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
