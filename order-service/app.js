const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  host: 'postgres-service',
  port: 5432,
  database: 'lugx_gaming',
  user: 'lugx_user',
  password: 'lugx_password',
});

// Create tables on startup
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_email VARCHAR(255) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        game_name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        quantity INTEGER DEFAULT 1
      )
    `);
    
    console.log('Order tables ready');
  } catch (err) {
    console.error('Database error:', err);
  }
}

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'order-service' });
});

// Get all orders
app.get('/orders', async (req, res) => {
  try {
    const orders = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    
    // Get items for each order
    for (let order of orders.rows) {
      const items = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
      order.items = items.rows;
    }
    
    res.json(orders.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single order
app.get('/orders/:id', async (req, res) => {
  try {
    const order = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const items = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]);
    order.rows[0].items = items.rows;
    
    res.json(order.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new order
app.post('/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { customer_email, items } = req.body;
    
    // Calculate total price
    const total_price = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Create order
    const orderResult = await client.query(
      'INSERT INTO orders (customer_email, total_price) VALUES ($1, $2) RETURNING *',
      [customer_email, total_price]
    );
    
    const order = orderResult.rows[0];
    
    // Add order items
    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, game_name, price, quantity) VALUES ($1, $2, $3, $4)',
        [order.id, item.game_name, item.price, item.quantity]
      );
    }
    
    await client.query('COMMIT');
    
    // Get complete order with items
    const items_result = await client.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    order.items = items_result.rows;
    
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update order status
app.put('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = 3003;
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Order Service running on port ${PORT}`);
  });
});