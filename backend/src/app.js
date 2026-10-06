import express from "express";
import cors from "cors";
import pg from "pg";
import { setupSwagger } from "./config/swagger.js";

const app = express();
const port = process.env.PORT || 5000;

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

setupSwagger(app); // หน้า docs ที่ /api/docs

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/db-check", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT NOW() AS now");
    res.json({ database: "connected", now: rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ database: "error", message: err.message });
  }
});

app.get("/api/users", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY id");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend listening on port ${port}`);
});