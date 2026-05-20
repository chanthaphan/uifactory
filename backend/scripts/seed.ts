import 'reflect-metadata';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';

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
  await prisma.app.deleteMany();
  await prisma.query.deleteMany();
  await prisma.dataSource.deleteMany();

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

  await prisma.query.createMany({
    data: [
      {
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
      {
        name: 'Revenue by product category',
        dataSourceId: sqliteDs.id,
        config: JSON.stringify({
          sql: `SELECT p.category, COUNT(*) AS orders, ROUND(SUM(o.total), 2) AS revenue
FROM orders o JOIN products p ON p.id = o.product_id
GROUP BY p.category
ORDER BY revenue DESC;`,
        }),
      },
      {
        name: 'All customers',
        dataSourceId: sqliteDs.id,
        config: JSON.stringify({ sql: 'SELECT * FROM customers ORDER BY created_at DESC;' }),
      },
      {
        name: 'GET /users',
        dataSourceId: restDs.id,
        config: JSON.stringify({ method: 'GET', path: '/users' }),
      },
      {
        name: 'GET /posts',
        dataSourceId: restDs.id,
        config: JSON.stringify({ method: 'GET', path: '/posts' }),
      },
    ],
  });

  console.log('Seed complete:');
  console.log('  - 2 data sources (SQLite + REST)');
  console.log('  - 5 example queries');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
