import express from "express";
import cors from "cors";
import { query } from "./config/db.js";
import { setupSwagger } from "./config/swagger.js";
import companiesRouter from "./routes/companies.js";
import v3Router from './routes/v3.js';
import documentsRouter from './routes/documents.js';
import { randomUUID } from 'node:crypto';
import { notFound, errorHandler } from "./middlewares/errorHandler.js";

// รวม Middleware และ Routes ของระบบ (ไม่มี app.listen ที่นี่)
// - รันในเครื่อง: src/server.js
// - รันบน AWS Lambda: src/lambda.js
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use((req, res, next) => { req.requestId = randomUUID(); res.set('X-Request-ID', req.requestId); next(); });
app.use(express.json({ limit: '256kb' }));

setupSwagger(app); // หน้า docs ที่ /api/docs

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/db-check", async (_req, res) => {
    const { rows } = await query("SELECT NOW() AS now");
    res.json({ database: "connected", now: rows[0].now });
});

app.use("/api/companies", companiesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api', v3Router);

app.use(notFound);
app.use(errorHandler);

export default app;
