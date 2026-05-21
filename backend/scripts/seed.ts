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

  db.close();
  return SAMPLE_DB;
}

async function main() {
  console.log('Building sample SQLite database…');
  const sampleDbPath = buildSampleDatabase();
  console.log(`  -> ${sampleDbPath}`);

  console.log('Resetting UIFactory metadata…');
  await prisma.appMembership.deleteMany();
  await prisma.app.deleteMany();
  await prisma.template.deleteMany();
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
  const DS: Record<'sqlite' | 'rest', TemplateDataSource> = {
    sqlite: { ref: 'sqlite', name: 'Sample Business DB (SQLite)', type: 'SQLITE', config: { file: sampleDbPath } },
    rest: { ref: 'rest', name: 'JSONPlaceholder (REST API)', type: 'REST', config: { baseUrl: 'https://jsonplaceholder.typicode.com' } },
  };
  const Q: Record<string, TemplateQuery> = {
    orders: { ref: 'q-orders', name: 'Recent orders with customer + product', dataSourceRef: 'sqlite', config: { sql: `SELECT o.id, c.name AS customer, p.name AS product, o.quantity, o.total, o.status, o.ordered_at\nFROM orders o JOIN customers c ON c.id = o.customer_id JOIN products p ON p.id = o.product_id\nORDER BY o.ordered_at DESC LIMIT 25;` } },
    revenue: { ref: 'q-revenue', name: 'Revenue by product category', dataSourceRef: 'sqlite', config: { sql: `SELECT p.category, COUNT(*) AS orders, ROUND(SUM(o.total),2) AS revenue\nFROM orders o JOIN products p ON p.id = o.product_id GROUP BY p.category ORDER BY revenue DESC;` } },
    customers: { ref: 'q-customers', name: 'All customers', dataSourceRef: 'sqlite', config: { sql: 'SELECT id, name, email, country, created_at FROM customers ORDER BY created_at DESC;' } },
    products: { ref: 'q-products', name: 'Product catalog', dataSourceRef: 'sqlite', config: { sql: 'SELECT id, name, category, price FROM products ORDER BY category, name;' } },
    ordersByStatus: { ref: 'q-orders-status', name: 'Orders by status', dataSourceRef: 'sqlite', config: { sql: `SELECT o.id, c.name AS customer, p.name AS product, o.total, o.status, o.ordered_at\nFROM orders o JOIN customers c ON c.id = o.customer_id JOIN products p ON p.id = o.product_id\nWHERE o.status = {{status}} ORDER BY o.ordered_at DESC;` } },
    addCustomer: { ref: 'q-add-customer', name: 'Add customer', dataSourceRef: 'sqlite', config: { sql: `INSERT INTO customers (name, email, country, created_at) VALUES ({{name}}, {{email}}, {{country}}, date('now'));` } },
    restUsers: { ref: 'q-rest-users', name: 'GET /users', dataSourceRef: 'rest', config: { method: 'GET', path: '/users' } },
  };
  const dsByRef: Record<string, TemplateDataSource> = { sqlite: DS.sqlite, rest: DS.rest };
  const bundle = (pages: AppPage[], queries: TemplateQuery[] = []): TemplateBundle => {
    const refs = [...new Set(queries.map((q) => q.dataSourceRef))];
    return { definition: { pages }, dataSources: refs.map((r) => dsByRef[r]), queries };
  };

  const samples = {
    orders: JSON.stringify([
      { id: 40, customer: 'Wayne Enterprises', product: 'Coffee Subscription', quantity: 4, total: 236, status: 'refunded' },
      { id: 39, customer: 'Stark Manufacturing', product: 'Laptop Pro 16', quantity: 3, total: 7197, status: 'shipped' },
    ]),
    revenue: JSON.stringify([
      { category: 'Electronics', orders: 20, revenue: 42860 },
      { category: 'Furniture', orders: 10, revenue: 7700 },
    ]),
    customers: JSON.stringify([
      { id: 1, name: 'Acme Robotics', email: 'ops@acme.io', country: 'USA', created_at: '2026-03-22' },
      { id: 2, name: 'Globex Foods', email: 'buy@globex.com', country: 'Canada', created_at: '2026-03-27' },
    ]),
    products: JSON.stringify([
      { id: 1, name: 'Standing Desk', category: 'Furniture', price: 420 },
      { id: 3, name: 'Laptop Pro 16', category: 'Electronics', price: 2399 },
    ]),
    users: JSON.stringify([
      { id: 1, name: 'Leanne Graham', username: 'Bret', email: 'Sincere@april.biz' },
      { id: 2, name: 'Ervin Howell', username: 'Antonette', email: 'Shanna@melissa.tv' },
    ]),
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
    { name: 'Orders Dashboard', description: 'Sortable, filterable table of recent orders.', category: 'Dashboard',
      bundle: bundle([uiPage('Orders', 'orders', Q.orders.ref, 'Orders dashboard with a sortable, filterable table and a row/total summary', samples.orders)], [Q.orders]) },
    { name: 'Revenue Analytics', description: 'Revenue by category with summary cards and a chart.', category: 'Dashboard',
      bundle: bundle([uiPage('Revenue', 'revenue', Q.revenue.ref, 'Revenue analytics: summary cards for totals plus a bar chart of revenue by category and a breakdown table', samples.revenue)], [Q.revenue]) },
    { name: 'Customer Directory', description: 'Searchable directory of customers.', category: 'Dashboard',
      bundle: bundle([uiPage('Customers', 'customers', Q.customers.ref, 'Customer directory: a searchable, sortable table with a country filter', samples.customers)], [Q.customers]) },
    { name: 'Product Catalog', description: 'Products grouped by category.', category: 'Dashboard',
      bundle: bundle([uiPage('Products', 'products', Q.products.ref, 'Product catalog: cards grouped by category showing name and price, with a search box', samples.products)], [Q.products]) },
    { name: 'REST API Explorer', description: 'Render data returned by a REST API.', category: 'Integration',
      bundle: bundle([uiPage('Users', 'users', Q.restUsers.ref, 'A table of users returned by the REST API with a text filter', samples.users)], [Q.restUsers]) },
    { name: 'Executive KPI Summary', description: 'High-level KPI cards from revenue data.', category: 'Dashboard',
      bundle: bundle([uiPage('Summary', 'summary', Q.revenue.ref, 'Executive summary: large KPI cards for total revenue, total orders, and the top category', samples.revenue)], [Q.revenue]) },
    { name: 'Support Assistant', description: 'A conversational chat assistant.', category: 'Chat',
      bundle: bundle([chatPage('Assistant', 'assistant', 'You are a friendly support assistant for our internal tools.', 'Hi! How can I help you today?')]) },
    { name: 'Data Analyst (grounded)', description: 'Chat grounded on revenue data.', category: 'Chat',
      bundle: bundle([chatPage('Analyst', 'analyst', 'You are a data analyst. Answer using the provided revenue dataset and cite the numbers.', 'Ask me about revenue by category.', Q.revenue.ref)], [Q.revenue]) },
    { name: 'SQL Query Helper', description: 'Assistant that helps write and explain SQL.', category: 'Chat',
      bundle: bundle([chatPage('SQL Helper', 'sql-helper', 'You are an expert SQL assistant. Help the user write and explain SQL queries.', 'Describe the query you need and I will help you write the SQL.')]) },
    { name: 'Operations Console', description: 'Multi-page: orders dashboard + AI assistant.', category: 'Multi-page',
      bundle: bundle([uiPage('Orders', 'orders', Q.orders.ref, 'Orders dashboard table', samples.orders), chatPage('Assistant', 'assistant', 'You are an operations analyst for the orders app.', 'How can I help with operations?', Q.revenue.ref)], [Q.orders, Q.revenue]) },
    { name: 'Customer 360', description: 'Multi-page: customer directory + grounded chat.', category: 'Multi-page',
      bundle: bundle([uiPage('Customers', 'customers', Q.customers.ref, 'Customer directory table', samples.customers), chatPage('Assistant', 'assistant', 'You are a CRM assistant. Use the customer dataset to answer questions.', 'Ask me about our customers.', Q.customers.ref)], [Q.customers]) },
    { name: 'Customer Admin (CRUD)', description: 'Customer table plus an add-customer form (write-back).', category: 'Forms',
      bundle: bundle([uiPage('Customers', 'customers', Q.customers.ref,
        'A customer admin screen: a table of customers, plus an "Add customer" form. On submit call UIFactory.runAction("createCustomer", {name, email, country}) then UIFactory.refresh().',
        samples.customers, [{ name: 'createCustomer', queryId: Q.addCustomer.ref }, { name: 'listCustomers', queryId: Q.customers.ref }])], [Q.customers, Q.addCustomer]) },
    { name: 'Orders by Status (filter)', description: 'Interactive orders list with a status filter.', category: 'Interactive',
      bundle: bundle([uiPage('Orders', 'orders', Q.orders.ref,
        'Orders list with a status dropdown (paid, pending, shipped, refunded). When it changes, call UIFactory.runAction("byStatus", {status}) and re-render the table.',
        samples.orders, [{ name: 'byStatus', queryId: Q.ordersByStatus.ref }])], [Q.orders, Q.ordersByStatus]) },
    { name: 'Blank Dashboard', description: 'Start from an empty UI page.', category: 'Starter',
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

  console.log('Creating a sample deployed app…');
  const sApp = await prisma.app.create({
    data: {
      name: 'Orders Operations',
      description: 'Sample multi-page app: an orders dashboard plus an AI assistant.',
      slug: slugify('Orders Operations'),
      definition: JSON.stringify({ pages: [] }),
      ownerId: admin.id,
      memberships: { create: [{ userEmail: admin.email, role: 'owner' }] },
    },
  });
  const sDs = await prisma.dataSource.create({
    data: { name: DS.sqlite.name, type: 'SQLITE', config: encryptString(JSON.stringify(DS.sqlite.config)), appId: sApp.id },
  });
  const sOrders = await prisma.query.create({ data: { name: Q.orders.name, dataSourceId: sDs.id, appId: sApp.id, config: JSON.stringify(Q.orders.config) } });
  const sRevenue = await prisma.query.create({ data: { name: Q.revenue.name, dataSourceId: sDs.id, appId: sApp.id, config: JSON.stringify(Q.revenue.config) } });
  const sampleDef: AppDefinition = {
    pages: [
      uiPage('Orders', 'orders', sOrders.id, 'Orders dashboard table', samples.orders),
      chatPage('Assistant', 'assistant', 'You are a business analyst for the Orders app. Answer using the revenue data.', 'Ask me about revenue by category.', sRevenue.id),
    ],
  };
  const sampleJson = JSON.stringify(sampleDef);
  await prisma.app.update({
    where: { id: sApp.id },
    data: { definition: sampleJson, publishedDefinition: sampleJson, version: 1, visibility: 'org', status: 'deployed', deployedAt: new Date() },
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
