import swaggerUi from "swagger-ui-express";

// เพิ่ม endpoint ใหม่ใน app.js (หรือ routes/) แล้วมาเพิ่มคำอธิบายใน "paths" ที่นี่
export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "CS361 Cooperative Education Plan API",
    version: "1.0.0",
    description: "REST API ของระบบ",
  },
  // url "/" = ใช้ host/port เดียวกับหน้านี้ ไม่ต้องแก้เมื่อเปลี่ยน BACKEND_PORT
  servers: [{ url: "/" }],
  tags: [
    { name: "System", description: "ตรวจสอบสถานะระบบ" },
    { name: "Users", description: "ข้อมูลผู้ใช้" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "เช็กว่า server ทำงานอยู่",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/db-check": {
      get: {
        tags: ["System"],
        summary: "เช็กการเชื่อมต่อฐานข้อมูล",
        responses: {
          200: {
            description: "เชื่อมต่อได้",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    database: { type: "string", example: "connected" },
                    now: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          500: { description: "เชื่อมต่อไม่ได้" },
        },
      },
    },
    "/api/users": {
      get: {
        tags: ["Users"],
        summary: "ดึงรายชื่อผู้ใช้ทั้งหมด",
        responses: {
          200: {
            description: "รายชื่อผู้ใช้",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
          500: { description: "เกิดข้อผิดพลาดที่ server" },
        },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Alice" },
          email: { type: "string", example: "alice@example.com" },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
};

// เรียกใน app.js:  setupSwagger(app)
// ปิดอัตโนมัติเมื่อ NODE_ENV=production
export function setupSwagger(app) {
  if (process.env.NODE_ENV === "production") return;
  app.get("/api/docs.json", (_req, res) => res.json(swaggerSpec));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}