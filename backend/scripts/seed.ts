import 'reflect-metadata';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { buildFallbackHtml } from '../src/ai/fallback-generator';
import { slugify, AppDefinition, AppPage } from '../src/apps/app-defs';

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

  // Built-in SQLite data source (works out of the box).
  const sqliteDs = await prisma.dataSource.create({
    data: {
      name: 'Sample Business DB (SQLite)',
      type: 'SQLITE',
      config: JSON.stringify({ file: sampleDbPath }),
    },
  });

  // Public REST data source for demoing the "generate UI from API output" flow.
  const restDs = await prisma.dataSource.create({
    data: {
      name: 'JSONPlaceholder (REST API)',
      type: 'REST',
      config: JSON.stringify({ baseUrl: 'https://jsonplaceholder.typicode.com' }),
    },
  });

  const ordersQuery = await prisma.query.create({
    data: {
      name: 'Recent orders with customer + product',
      dataSourceId: sqliteDs.id,
      config: JSON.stringify({
        sql: `SELECT o.id, c.name AS customer, p.name AS product, o.quantity, o.total, o.status, o.ordered_at
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN products p ON p.id = o.product_id
ORDER BY o.ordered_at DESC
LIMIT 25;`,
      }),
    },
  });
  const revenueQuery = await prisma.query.create({
    data: {
      name: 'Revenue by product category',
      dataSourceId: sqliteDs.id,
      config: JSON.stringify({
        sql: `SELECT p.category, COUNT(*) AS orders, ROUND(SUM(o.total), 2) AS revenue
FROM orders o JOIN products p ON p.id = o.product_id
GROUP BY p.category
ORDER BY revenue DESC;`,
      }),
    },
  });
  const customersQuery = await prisma.query.create({
    data: {
      name: 'All customers',
      dataSourceId: sqliteDs.id,
      config: JSON.stringify({ sql: 'SELECT id, name, email, country, created_at FROM customers ORDER BY created_at DESC;' }),
    },
  });
  const productsQuery = await prisma.query.create({
    data: {
      name: 'Product catalog',
      dataSourceId: sqliteDs.id,
      config: JSON.stringify({ sql: 'SELECT id, name, category, price FROM products ORDER BY category, name;' }),
    },
  });
  const ordersByStatusQuery = await prisma.query.create({
    data: {
      name: 'Orders by status',
      dataSourceId: sqliteDs.id,
      config: JSON.stringify({
        sql: `SELECT o.id, c.name AS customer, p.name AS product, o.total, o.status, o.ordered_at
FROM orders o JOIN customers c ON c.id = o.customer_id JOIN products p ON p.id = o.product_id
WHERE o.status = {{status}}
ORDER BY o.ordered_at DESC;`,
      }),
    },
  });
  const addCustomerQuery = await prisma.query.create({
    data: {
      name: 'Add customer',
      dataSourceId: sqliteDs.id,
      config: JSON.stringify({
        sql: `INSERT INTO customers (name, email, country, created_at) VALUES ({{name}}, {{email}}, {{country}}, date('now'));`,
      }),
    },
  });
  const restUsersQuery = await prisma.query.create({
    data: { name: 'GET /users', dataSourceId: restDs.id, config: JSON.stringify({ method: 'GET', path: '/users' }) },
  });
  await prisma.query.create({
    data: { name: 'GET /posts', dataSourceId: restDs.id, config: JSON.stringify({ method: 'GET', path: '/posts' }) },
  });

  console.log('Creating templates…');
  const pid = () => `page-${randomBytes(3).toString('hex')}`;
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
  const ordersSample = samples.orders;
  const ordersHtml = buildFallbackHtml('Orders dashboard with a sortable, filterable table', ordersSample, 'Orders');

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

  const templates: { name: string; description: string; category: string; definition: AppDefinition }[] = [
    { name: 'Orders Dashboard', description: 'Sortable, filterable table of recent orders.', category: 'Dashboard',
      definition: { pages: [uiPage('Orders', 'orders', ordersQuery.id, 'Orders dashboard with a sortable, filterable table and a row/total summary', samples.orders)] } },
    { name: 'Revenue Analytics', description: 'Revenue by category with summary cards and a chart.', category: 'Dashboard',
      definition: { pages: [uiPage('Revenue', 'revenue', revenueQuery.id, 'Revenue analytics: summary cards for totals plus a bar chart of revenue by category and a breakdown table', samples.revenue)] } },
    { name: 'Customer Directory', description: 'Searchable directory of customers.', category: 'Dashboard',
      definition: { pages: [uiPage('Customers', 'customers', customersQuery.id, 'Customer directory: a searchable, sortable table with a country filter', samples.customers)] } },
    { name: 'Product Catalog', description: 'Products grouped by category.', category: 'Dashboard',
      definition: { pages: [uiPage('Products', 'products', productsQuery.id, 'Product catalog: cards grouped by category showing name and price, with a search box', samples.products)] } },
    { name: 'REST API Explorer', description: 'Render data returned by a REST API.', category: 'Integration',
      definition: { pages: [uiPage('Users', 'users', restUsersQuery.id, 'A table of users returned by the REST API with a text filter', samples.users)] } },
    { name: 'Executive KPI Summary', description: 'High-level KPI cards from revenue data.', category: 'Dashboard',
      definition: { pages: [uiPage('Summary', 'summary', revenueQuery.id, 'Executive summary: large KPI cards for total revenue, total orders, and the top category', samples.revenue)] } },
    { name: 'Support Assistant', description: 'A conversational chat assistant.', category: 'Chat',
      definition: { pages: [chatPage('Assistant', 'assistant', 'You are a friendly support assistant for our internal tools.', 'Hi! How can I help you today?')] } },
    { name: 'Data Analyst (grounded)', description: 'Chat grounded on revenue data.', category: 'Chat',
      definition: { pages: [chatPage('Analyst', 'analyst', 'You are a data analyst. Answer using the provided revenue dataset and cite the numbers.', 'Ask me about revenue by category.', revenueQuery.id)] } },
    { name: 'SQL Query Helper', description: 'Assistant that helps write and explain SQL.', category: 'Chat',
      definition: { pages: [chatPage('SQL Helper', 'sql-helper', 'You are an expert SQL assistant. Help the user write and explain SQL queries.', 'Describe the query you need and I will help you write the SQL.')] } },
    { name: 'Operations Console', description: 'Multi-page: orders dashboard + AI assistant.', category: 'Multi-page',
      definition: { pages: [uiPage('Orders', 'orders', ordersQuery.id, 'Orders dashboard table', samples.orders), chatPage('Assistant', 'assistant', 'You are an operations analyst for the orders app.', 'How can I help with operations?', revenueQuery.id)] } },
    { name: 'Customer 360', description: 'Multi-page: customer directory + grounded chat.', category: 'Multi-page',
      definition: { pages: [uiPage('Customers', 'customers', customersQuery.id, 'Customer directory table', samples.customers), chatPage('Assistant', 'assistant', 'You are a CRM assistant. Use the customer dataset to answer questions.', 'Ask me about our customers.', customersQuery.id)] } },
    { name: 'Customer Admin (CRUD)', description: 'Customer table plus an add-customer form (write-back).', category: 'Forms',
      definition: { pages: [uiPage('Customers', 'customers', customersQuery.id,
        'A customer admin screen: a table of customers, plus an "Add customer" form with name, email and country fields. On submit call UIFactory.runAction("createCustomer", {name, email, country}) then UIFactory.refresh().',
        samples.customers, [{ name: 'createCustomer', queryId: addCustomerQuery.id }, { name: 'listCustomers', queryId: customersQuery.id }])] } },
    { name: 'Orders by Status (filter)', description: 'Interactive orders list with a status filter.', category: 'Interactive',
      definition: { pages: [uiPage('Orders', 'orders', ordersQuery.id,
        'Orders list with a status dropdown (paid, pending, shipped, refunded). When it changes, call UIFactory.runAction("byStatus", {status}) and re-render the table with the returned rows.',
        samples.orders, [{ name: 'byStatus', queryId: ordersByStatusQuery.id }])] } },
    { name: 'Blank Dashboard', description: 'Start from an empty UI page.', category: 'Starter',
      definition: { pages: [{ id: pid(), name: 'Home', slug: 'home', type: 'ui' }] } },
    { name: 'Blank Chat', description: 'Start from an empty chat page.', category: 'Starter',
      definition: { pages: [{ id: pid(), name: 'Chat', slug: 'chat', type: 'chat', chat: { greeting: 'Hi! How can I help?' } }] } },
  ];

  for (const t of templates) {
    await prisma.template.create({
      data: { name: t.name, description: t.description, category: t.category, definition: JSON.stringify(t.definition), createdById: admin.id },
    });
  }
  console.log(`  -> ${templates.length} templates created`);

  console.log('Creating a sample deployed app…');
  const sampleAppDef: AppDefinition = {
    pages: [
      { id: pid(), name: 'Orders', slug: 'orders', type: 'ui', queryId: ordersQuery.id, prompt: 'Orders dashboard table', html: ordersHtml, sample: ordersSample },
      {
        id: pid(),
        name: 'Assistant',
        slug: 'assistant',
        type: 'chat',
        chat: { systemPrompt: 'You are a business analyst for the Orders app. Answer using the revenue data.', queryId: revenueQuery.id, greeting: 'Ask me about revenue by category.' },
      },
    ],
  };
  const sampleDefJson = JSON.stringify(sampleAppDef);
  await prisma.app.create({
    data: {
      name: 'Orders Operations',
      description: 'Sample multi-page app: an orders dashboard plus an AI assistant.',
      slug: slugify('Orders Operations'),
      definition: sampleDefJson,
      publishedDefinition: sampleDefJson,
      version: 1,
      visibility: 'org',
      status: 'deployed',
      deployedAt: new Date(),
      ownerId: admin.id,
      memberships: { create: [{ userEmail: admin.email, role: 'owner' }] },
    },
  });

  await prisma.setting.create({ data: { key: 'platformName', value: JSON.stringify('UIFactory') } });

  console.log('Seed complete:');
  console.log('  - 3 users (1 admin, 2 members)');
  console.log('  - 2 data sources (SQLite + REST), 8 queries');
  console.log(`  - ${templates.length} templates, 1 deployed sample app`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
