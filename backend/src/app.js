import express from "express";
import cors from "cors";
import { query } from "./config/db.js";
import { setupSwagger } from "./config/swagger.js";
import companiesRouter from "./routes/companies.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";

// รวม Middleware และ Routes ของระบบ (ไม่มี app.listen ที่นี่)
// - รันในเครื่อง: src/server.js
// - รันบน AWS Lambda: src/lambda.js
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

setupSwagger(app); // หน้า docs ที่ /api/docs

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/db-check", async (_req, res) => {
  try {
    const { rows } = await query("SELECT NOW() AS now");
    res.json({ database: "connected", now: rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ database: "error", message: err.message });
  }
});

app.get("/api/users", async (_req, res) => {
  try {
    const { rows } = await query("SELECT * FROM users ORDER BY id");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.use("/api/companies", companiesRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
