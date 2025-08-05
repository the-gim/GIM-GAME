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

// Create games table on startup
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        release_date DATE NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Games table ready');
  } catch (err) {
    console.error('Database error:', err);
  }
}

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'game-service' });
});

// Get all games
app.get('/games', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM games ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single game
app.get('/games/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM games WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new game
//commentt
app.post('/games', async (req, res) => {
  try {
    const { name, category, release_date, price } = req.body;
    const result = await pool.query(
      'INSERT INTO games (name, category, release_date, price) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, category, release_date, price]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update game
app.put('/games/:id', async (req, res) => {
  try {
    const { name, category, release_date, price } = req.body;
    const result = await pool.query(
      'UPDATE games SET name = $1, category = $2, release_date = $3, price = $4 WHERE id = $5 RETURNING *',
      [name, category, release_date, price, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete game
app.delete('/games/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM games WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json({ message: 'Game deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = 3001;
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Game Service running on port ${PORT}`);
  });
});