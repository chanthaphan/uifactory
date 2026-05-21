import 'reflect-metadata';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { buildFallbackHtml } from '../src/ai/fallback-generator';
import { slugify, AppDefinition } from '../src/apps/app-defs';

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
  await prisma.query.create({
    data: {
      name: 'All customers',
      dataSourceId: sqliteDs.id,
      config: JSON.stringify({ sql: 'SELECT * FROM customers ORDER BY created_at DESC;' }),
    },
  });
  await prisma.query.create({
    data: { name: 'GET /users', dataSourceId: restDs.id, config: JSON.stringify({ method: 'GET', path: '/users' }) },
  });
  await prisma.query.create({
    data: { name: 'GET /posts', dataSourceId: restDs.id, config: JSON.stringify({ method: 'GET', path: '/posts' }) },
  });

  console.log('Creating templates…');
  const ordersSample = JSON.stringify([
    { id: 40, customer: 'Wayne Enterprises', product: 'Coffee Subscription', quantity: 4, total: 236, status: 'refunded' },
    { id: 39, customer: 'Stark Manufacturing', product: 'Laptop Pro 16', quantity: 3, total: 7197, status: 'shipped' },
  ]);
  const ordersHtml = buildFallbackHtml('Orders dashboard with a sortable, filterable table', ordersSample, 'Orders');

  const pid = () => `page-${randomBytes(3).toString('hex')}`;

  const dashboardTemplateDef: AppDefinition = {
    pages: [
      { id: pid(), name: 'Orders', slug: 'orders', type: 'ui', queryId: ordersQuery.id, prompt: 'Orders dashboard table', html: ordersHtml, sample: ordersSample },
    ],
  };
  const assistantTemplateDef: AppDefinition = {
    pages: [
      {
        id: pid(),
        name: 'Assistant',
        slug: 'assistant',
        type: 'chat',
        chat: { systemPrompt: 'You are a helpful business analyst.', greeting: 'Hi! How can I help you today?' },
      },
    ],
  };

  await prisma.template.create({
    data: {
      name: 'Orders Dashboard',
      description: 'A data table bound to a SQL query.',
      category: 'Dashboard',
      definition: JSON.stringify(dashboardTemplateDef),
      createdById: admin.id,
    },
  });
  await prisma.template.create({
    data: {
      name: 'Support Assistant',
      description: 'A conversational chat UI.',
      category: 'Chat',
      definition: JSON.stringify(assistantTemplateDef),
      createdById: admin.id,
    },
  });

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
  await prisma.app.create({
    data: {
      name: 'Orders Operations',
      description: 'Sample multi-page app: an orders dashboard plus an AI assistant.',
      slug: slugify('Orders Operations'),
      definition: JSON.stringify(sampleAppDef),
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
  console.log('  - 2 data sources (SQLite + REST), 5 queries');
  console.log('  - 2 templates, 1 deployed sample app');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
