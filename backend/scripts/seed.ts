import 'reflect-metadata';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { buildFallbackHtml } from '../src/ai/fallback-generator';
import { slugify, AppDefinition, AppPage, TemplateBundle, TemplateDataSource, TemplateQuery } from '../src/apps/app-defs';
import { encryptString } from '../src/common/crypto.util';

const prisma = new PrismaClient();

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SAMPLE_DB = path.join(DATA_DIR, 'sample.db');

/** Create a demo "business" SQLite database with customers, products and orders. */
function buildSampleDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(SAMPLE_DB)) fs.rmSync(SAMPLE_DB);

  const db = new DatabaseSync(SAMPLE_DB);
  db.exec(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      country TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL
    );
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL,
      ordered_at TEXT NOT NULL
    );
    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY,
      holder TEXT NOT NULL,
      account_no TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL,
      currency TEXT NOT NULL,
      opened_at TEXT NOT NULL
    );
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY,
      account_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const customers = [
    ['Acme Robotics', 'ops@acme.io', 'USA'],
    ['Globex Foods', 'buy@globex.com', 'Canada'],
    ['Initech Software', 'it@initech.com', 'USA'],
    ['Umbrella Health', 'orders@umbrella.co', 'UK'],
    ['Soylent Green Co', 'hello@soylent.co', 'Germany'],
    ['Wonka Industries', 'sweet@wonka.com', 'UK'],
    ['Stark Manufacturing', 'proc@stark.com', 'USA'],
    ['Wayne Enterprises', 'supply@wayne.com', 'USA'],
  ];
  const products = [
    ['Standing Desk', 'Furniture', 420.0],
    ['Ergonomic Chair', 'Furniture', 280.0],
    ['Laptop Pro 16', 'Electronics', 2399.0],
    ['Wireless Mouse', 'Electronics', 39.0],
    ['Noise-Cancel Headset', 'Electronics', 199.0],
    ['Coffee Subscription', 'Pantry', 59.0],
    ['Whiteboard XL', 'Office', 149.0],
    ['Monitor 27 4K', 'Electronics', 549.0],
  ];
  const statuses = ['paid', 'pending', 'shipped', 'refunded'];

  const insCustomer = db.prepare('INSERT INTO customers (id,name,email,country,created_at) VALUES (?,?,?,?,?)');
  customers.forEach((c, i) => {
    const d = new Date(Date.now() - (60 - i * 5) * 86400000).toISOString().slice(0, 10);
    insCustomer.run(i + 1, c[0], c[1], c[2], d);
  });

  const insProduct = db.prepare('INSERT INTO products (id,name,category,price) VALUES (?,?,?,?)');
  products.forEach((p, i) => insProduct.run(i + 1, p[0], p[1], p[2]));

  const insOrder = db.prepare(
    'INSERT INTO orders (id,customer_id,product_id,quantity,total,status,ordered_at) VALUES (?,?,?,?,?,?,?)',
  );
  let orderId = 1;
  for (let i = 0; i < 40; i++) {
    const customerId = (i % customers.length) + 1;
    const productId = (i * 3) % products.length;
    const product = products[productId];
    const qty = (i % 4) + 1;
    const total = Number((product[2] as number) * qty);
    const status = statuses[i % statuses.length];
    const orderedAt = new Date(Date.now() - (40 - i) * 86400000).toISOString().slice(0, 10);
    insOrder.run(orderId++, customerId, productId + 1, qty, total, status, orderedAt);
  }

  // ---- retail-banking demo data (for the bank templates) ----
  const accounts = [
    ['Somchai Phan', 'TH-100001', 'Savings', 84210.55, 'THB'],
    ['Aroon Srisuk', 'TH-100002', 'Current', 12050.0, 'THB'],
    ['Mei Lin', 'TH-100003', 'Savings', 305980.2, 'THB'],
    ['John Carter', 'TH-100004', 'Current', 4520.75, 'THB'],
    ['Priya Nair', 'TH-100005', 'Savings', 67310.0, 'THB'],
    ['Kenji Watanabe', 'TH-100006', 'Current', 158900.4, 'THB'],
  ];
  const insAccount = db.prepare('INSERT INTO accounts (id,holder,account_no,type,balance,currency,opened_at) VALUES (?,?,?,?,?,?,?)');
  accounts.forEach((a, i) => {
    const d = new Date(Date.now() - (900 - i * 40) * 86400000).toISOString().slice(0, 10);
    insAccount.run(i + 1, a[0], a[1], a[2], a[3], a[4], d);
  });

  const txnCats: [string, 'debit' | 'credit', string][] = [
    ['Groceries', 'debit', 'Big C supermarket'],
    ['Dining', 'debit', 'Restaurant POS'],
    ['Utilities', 'debit', 'MEA electricity bill'],
    ['Transfer', 'debit', 'PromptPay transfer'],
    ['ATM', 'debit', 'ATM withdrawal'],
    ['Fees', 'debit', 'Monthly account fee'],
    ['Salary', 'credit', 'Payroll deposit'],
    ['Refund', 'credit', 'Merchant refund'],
    ['Interest', 'credit', 'Savings interest'],
  ];
  const txnStatuses = ['posted', 'pending', 'reversed'];
  const insTxn = db.prepare('INSERT INTO transactions (id,account_id,type,category,amount,currency,status,description,created_at) VALUES (?,?,?,?,?,?,?,?,?)');
  for (let i = 0; i < 60; i++) {
    const accountId = (i % accounts.length) + 1;
    const [category, type, description] = txnCats[i % txnCats.length];
    const base = type === 'credit' ? 1500 + (i % 7) * 4200 : 80 + (i % 11) * 360;
    const amount = Number((base + (i % 5) * 13.5).toFixed(2));
    const status = txnStatuses[i % 3 === 0 ? (i % 9 === 0 ? 2 : 0) : 0 + (i % 5 === 0 ? 1 : 0)];
    const createdAt = new Date(Date.now() - (60 - i) * 43200000).toISOString().slice(0, 19).replace('T', ' ');
    insTxn.run(i + 1, accountId, type, category, amount, 'THB', status, description, createdAt);
  }

  db.close();
  return SAMPLE_DB;
}

async function main() {
  console.log('Building sample SQLite database…');
  const sampleDbPath = buildSampleDatabase();
  console.log(`  -> ${sampleDbPath}`);

  console.log('Resetting UIFactory metadata…');
  await prisma.appMembership.deleteMany();
  await prisma.app.deleteMany(); // cascades AppVersion
  await prisma.template.deleteMany();
  await prisma.connector.deleteMany();
  await prisma.query.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creating users…');
  const admin = await prisma.user.create({
    data: { email: 'admin@uifactory.local', name: 'Platform Admin', role: 'admin' },
  });
  await prisma.user.create({ data: { email: 'alice@uifactory.local', name: 'Alice Member', role: 'member' } });
  await prisma.user.create({ data: { email: 'bob@uifactory.local', name: 'Bob Member', role: 'member' } });

  console.log('Creating templates…');
  const pid = () => `page-${randomBytes(3).toString('hex')}`;

  // Portable bundle building blocks: data sources + queries referenced by local refs.
  // The "Agent API" is the org's deployed agent (set its base URL after cloning). Its responses are
  // intentionally dynamic (plain text or arbitrary JSON), so generated UIs decode them at runtime.
  const DS: Record<'sqlite' | 'agent', TemplateDataSource> = {
    sqlite: { ref: 'sqlite', name: 'Core Banking DB (SQLite)', type: 'SQLITE', config: { file: sampleDbPath } },
    agent: { ref: 'agent', name: 'Agent API (set your endpoint URL)', type: 'REST', config: { baseUrl: 'https://your-agent.example.com' } },
  };
  const Q: Record<string, TemplateQuery> = {
    // banking data (SQLite)
    transactions: { ref: 'q-transactions', name: 'Recent transactions', dataSourceRef: 'sqlite', config: { sql: `SELECT t.id, a.holder, a.account_no, t.type, t.category, t.amount, t.currency, t.status, t.description, t.created_at\nFROM transactions t JOIN accounts a ON a.id = t.account_id ORDER BY t.created_at DESC LIMIT 50;` } },
    spendByCategory: { ref: 'q-spend-category', name: 'Spend by category', dataSourceRef: 'sqlite', config: { sql: `SELECT category, ROUND(SUM(amount),2) AS total, COUNT(*) AS transactions\nFROM transactions WHERE type = 'debit' GROUP BY category ORDER BY total DESC;` } },
    // agent-as-API calls (dynamic responses the UI must decode)
    translate: { ref: 'q-translate', name: 'Translate (agent)', dataSourceRef: 'agent', config: { method: 'POST', path: '/translate', body: { text: '{{text}}', target_language: '{{target}}' }, schema: 'POST { text, target_language }. The agent replies with the translation as a plain string OR an object like { "translation": "..." }. Render whatever text comes back; do not assume a fixed key.' } },
    extract: { ref: 'q-extract', name: 'Extract PDF text (agent)', dataSourceRef: 'agent', config: { method: 'POST', path: '/extract', body: { filename: '{{filename}}', content_base64: '{{contentBase64}}' }, schema: 'POST a base64-encoded PDF { filename, content_base64 }. Returns the extracted text as a plain string OR { "text": "..." }.' } },
    parse: { ref: 'q-parse', name: 'Parse text to table (agent)', dataSourceRef: 'agent', config: { method: 'POST', path: '/parse', body: { text: '{{text}}', instructions: '{{instructions}}' }, schema: 'POST raw text { text, instructions? }. Returns a DYNAMIC JSON array of row objects whose columns are not known ahead of time. Build the table by reading keys from the rows at runtime.' } },
  };
  const dsByRef: Record<string, TemplateDataSource> = { sqlite: DS.sqlite, agent: DS.agent };
  const bundle = (pages: AppPage[], queries: TemplateQuery[] = [], guidelines?: string): TemplateBundle => {
    const refs = [...new Set(queries.map((q) => q.dataSourceRef))];
    return {
      definition: { pages, ...(guidelines ? { buildGuidelines: guidelines } : {}) },
      dataSources: refs.map((r) => dsByRef[r]),
      queries,
    };
  };

  // Shared guidance for templates that call the dynamic Agent API.
  const DYNAMIC_GUIDE = [
    'This app calls an external Agent API whose response shape is DYNAMIC: it may be a plain text string, a JSON object, or a JSON array, and field names can vary per request.',
    'Generated UIs must NOT assume a fixed schema. At runtime: if the response is a string, render it as text/markdown; if it is an array of objects, render a table whose columns are derived from the row keys; if it is an object, render a labelled key/value detail view (surface any obvious main-text field prominently).',
    'Always show loading and error states: read the user input, call the relevant UIFactory.runAction(...), then decode and display whatever comes back.',
  ].join('\n');

  const samples = {
    transactions: JSON.stringify([
      { id: 60, holder: 'Kenji Watanabe', account_no: 'TH-100006', type: 'credit', category: 'Salary', amount: 26700, currency: 'THB', status: 'posted', description: 'Payroll deposit', created_at: '2026-05-21 06:00:00' },
      { id: 59, holder: 'Priya Nair', account_no: 'TH-100005', type: 'debit', category: 'Groceries', amount: 1240.5, currency: 'THB', status: 'posted', description: 'Big C supermarket', created_at: '2026-05-20 18:00:00' },
    ]),
    empty: '{}',
  };

  const uiPage = (
    name: string,
    slug: string,
    queryId: string,
    prompt: string,
    sample: string,
    actions?: { name: string; queryId: string }[],
  ): AppPage => ({
    id: pid(),
    name,
    slug,
    type: 'ui',
    queryId,
    prompt,
    sample,
    html: buildFallbackHtml(prompt, sample, name),
    ...(actions ? { actions } : {}),
  });
  const chatPage = (name: string, slug: string, systemPrompt: string, greeting: string, queryId?: string): AppPage => ({
    id: pid(),
    name,
    slug,
    type: 'chat',
    chat: { systemPrompt, greeting, ...(queryId ? { queryId } : {}) },
  });

  const templates: { name: string; description: string; category: string; bundle: TemplateBundle }[] = [
    { name: 'Conversational Banking Agent', description: 'A retail-banking virtual assistant. Pair it with your deployed Agent API in Settings → AI / agent connection.', category: 'Agent',
      bundle: bundle([chatPage('Assistant', 'assistant',
        'You are a helpful retail-banking virtual assistant. Be concise and accurate, never invent account balances or personal data, and ask the customer to authenticate before sharing anything sensitive. Use markdown for structure.',
        'Hi! I can help with accounts, cards, payments and general banking questions. How can I help today?')],
        [], 'Replies come from a deployed conversation Agent API and are plain text/markdown — render them directly.') },

    { name: 'Contact Center Knowledge Base', description: 'Agent-assist KB lookup for contact-center staff. Connect a Knowledge Base Agent API.', category: 'Agent',
      bundle: bundle([chatPage('Knowledge Base', 'kb',
        'You are a contact-center knowledge-base assistant for bank agents. Answer strictly from the knowledge base and cite the article title you used. If the KB does not cover it, say so and suggest escalation. Keep answers short and actionable.',
        'Ask a customer question and I will find the answer from the knowledge base.')],
        [], 'Backed by a Knowledge Base Agent API. Render the agent\'s markdown answer and any cited sources directly.') },

    { name: 'Chat with your data', description: 'Ask questions in natural language about live transaction data.', category: 'Data',
      bundle: bundle([chatPage('Data Chat', 'data-chat',
        'You are a banking data analyst. Answer using ONLY the provided transactions dataset (JSON). Show the numbers you used and a short explanation. If the data does not contain the answer, say so.',
        'Ask me about recent transactions, spend by category, or account activity.', Q.transactions.ref)],
        [Q.transactions]) },

    { name: 'Translate Side-by-Side', description: 'Side-by-side translator backed by a translation Agent API.', category: 'Agent',
      bundle: bundle([uiPage('Translate', 'translate', '',
        'Build a side-by-side translator for a bank. Left pane: a large source-text textarea and a target-language dropdown (English, Thai, Chinese, Japanese, Spanish). Right pane: the translation. On "Translate", call UIFactory.runAction("translate", { text, target }). The agent may return a plain string or an object like { translation }; detect the shape at runtime and show the resulting text. Include loading and error states and a copy button.',
        samples.empty, [{ name: 'translate', queryId: Q.translate.ref }])],
        [Q.translate], DYNAMIC_GUIDE) },

    { name: 'PDF Text Extraction', description: 'Upload a PDF; an Agent API returns the extracted text.', category: 'Documents',
      bundle: bundle([uiPage('Extract', 'extract', '',
        'Build a PDF text-extraction tool. Provide a file input (accept "application/pdf"). On selection, call UIFactory.readFile(input.files[0]); take the base64 part of result.dataUrl (after the comma) and call UIFactory.runAction("extract", { filename: result.name, contentBase64 }). The agent returns the extracted text as a string or { text }. Render it in a scrollable panel with a copy-to-clipboard button; show progress while extracting and handle errors.',
        samples.empty, [{ name: 'extract', queryId: Q.extract.ref }])],
        [Q.extract], DYNAMIC_GUIDE) },

    { name: 'Parse Text into a Table', description: 'Paste freeform text; an Agent API returns structured rows to render as a table.', category: 'Documents',
      bundle: bundle([uiPage('Parse', 'parse', '',
        'Build a "text to table" tool. A large textarea for pasted text plus an optional "columns / instructions" field. On submit, call UIFactory.runAction("parse", { text, instructions }). The agent returns a DYNAMIC JSON array of row objects whose keys are not known in advance. At runtime, derive the table header from the first row\'s keys, render all rows, and add a CSV download via UIFactory.downloadCSV. If the response is a string, display it as-is.',
        samples.empty, [{ name: 'parse', queryId: Q.parse.ref }])],
        [Q.parse], DYNAMIC_GUIDE) },

    { name: 'Transactions Dashboard', description: 'KPI cards, spend-by-category chart and a filterable transactions table.', category: 'Dashboard',
      bundle: bundle([uiPage('Transactions', 'transactions', Q.transactions.ref,
        'A retail-banking transactions dashboard: KPI cards (total credits, total debits, transaction count), a bar chart of spend by category (debits only), and a filterable, sortable transactions table (date, holder, account, type, category, amount, status). Format money with its currency and include a text filter.',
        samples.transactions)],
        [Q.transactions]) },

    { name: 'Agent Console (chat + documents)', description: 'Multi-page: a conversation agent plus a parse-to-table tool.', category: 'Multi-page',
      bundle: bundle([
        chatPage('Assistant', 'assistant', 'You are a banking operations assistant. Be concise and cite data when available.', 'How can I help?'),
        uiPage('Parse', 'parse', '', 'Paste text and call UIFactory.runAction("parse", { text }); render the dynamic array the agent returns as a table.', samples.empty, [{ name: 'parse', queryId: Q.parse.ref }]),
      ], [Q.parse], DYNAMIC_GUIDE) },

    { name: 'Blank Dashboard', description: 'Start from an empty UI page (drag-and-drop or AI generate).', category: 'Starter',
      bundle: bundle([{ id: pid(), name: 'Home', slug: 'home', type: 'ui' }]) },
    { name: 'Blank Chat', description: 'Start from an empty chat page.', category: 'Starter',
      bundle: bundle([{ id: pid(), name: 'Chat', slug: 'chat', type: 'chat', chat: { greeting: 'Hi! How can I help?' } }]) },
  ];

  for (const t of templates) {
    await prisma.template.create({
      data: { name: t.name, description: t.description, category: t.category, definition: JSON.stringify(t.bundle), createdById: admin.id },
    });
  }
  console.log(`  -> ${templates.length} templates created`);

  console.log('Creating prebuilt connectors…');
  const connectors: { name: string; description: string; category: string; type: string; config: Record<string, unknown> }[] = [
    { name: 'Core Banking DB (SQLite)', description: 'Seeded accounts & transactions demo database.', category: 'Internal', type: 'SQLITE', config: { file: sampleDbPath } },
    { name: 'Agent API (your deployed agent)', description: 'Your agent-builder endpoint. Returns dynamic text/JSON that the app decodes for chat, translation, extraction and parsing.', category: 'Agent', type: 'REST', config: { baseUrl: 'https://your-agent.example.com' } },
    { name: 'Microsoft 365 (Graph)', description: 'Org directory, mail and calendar via Microsoft Graph.', category: 'Microsoft', type: 'MSGRAPH', config: {} },
  ];
  for (const c of connectors) {
    await prisma.connector.create({
      data: { name: c.name, description: c.description, category: c.category, type: c.type, config: encryptString(JSON.stringify(c.config)), createdById: admin.id },
    });
  }
  console.log(`  -> ${connectors.length} prebuilt connectors created`);

  console.log('Creating a sample deployed app…');
  const sApp = await prisma.app.create({
    data: {
      name: 'Retail Banking Console',
      description: 'Sample multi-page app: a transactions dashboard plus a data-grounded assistant.',
      slug: slugify('Retail Banking Console'),
      definition: JSON.stringify({ pages: [] }),
      ownerId: admin.id,
      memberships: { create: [{ userEmail: admin.email, role: 'owner' }] },
    },
  });
  const sDs = await prisma.dataSource.create({
    data: { name: DS.sqlite.name, type: 'SQLITE', config: encryptString(JSON.stringify(DS.sqlite.config)), appId: sApp.id },
  });
  const sTxns = await prisma.query.create({ data: { name: Q.transactions.name, dataSourceId: sDs.id, appId: sApp.id, config: JSON.stringify(Q.transactions.config) } });
  const sampleDef: AppDefinition = {
    pages: [
      uiPage('Transactions', 'transactions', sTxns.id,
        'A retail-banking transactions dashboard: KPI cards (total credits, total debits, count), a bar chart of spend by category, and a filterable, sortable transactions table.',
        samples.transactions),
      chatPage('Assistant', 'assistant', 'You are a banking data analyst. Answer using the provided transactions dataset and cite the numbers.', 'Ask me about recent transactions or spend by category.', sTxns.id),
    ],
  };
  const sampleJson = JSON.stringify(sampleDef);
  await prisma.app.update({
    where: { id: sApp.id },
    data: { definition: sampleJson, publishedDefinition: sampleJson, version: 1, visibility: 'org', status: 'deployed', deployedAt: new Date() },
  });
  await prisma.appVersion.create({
    data: { appId: sApp.id, version: 1, definition: sampleJson, note: 'Initial published version', createdById: admin.id },
  });

  await prisma.setting.create({ data: { key: 'platformName', value: JSON.stringify('UIFactory') } });

  console.log('Seed complete:');
  console.log('  - 3 users (1 admin, 2 members)');
  console.log(`  - ${templates.length} templates (self-contained bundles), 1 deployed sample app`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
