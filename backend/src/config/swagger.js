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
    { name: "Companies", description: "ข้อมูลสถานประกอบการ" },
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
    "/api/companies": {
      get: {
        tags: ["Companies"],
        summary: "ค้นหาและกรองสถานประกอบการ",
        description: "ไม่ส่ง parameter = ได้ทุกบริษัท",
        parameters: [
          {
            name: "search",
            in: "query",
            description: "คำค้นใน name, description, location, province และชื่อตำแหน่งงาน",
            schema: { type: "string" },
          },
          {
            name: "province",
            in: "query",
            description: "ชื่อจังหวัด (ตรงทั้งคำ)",
            schema: { type: "string", example: "นนทบุรี" },
          },
          {
            name: "position",
            in: "query",
            description: "ชื่อตำแหน่งงาน (ตรงทั้งคำ)",
            schema: { type: "string", example: "Data Analyst Intern" },
          },
          {
            name: "status",
            in: "query",
            description: "สถานะการรับสมัคร ณ วันนี้ (เวลาประเทศไทย)",
            schema: { type: "string", enum: ["open", "upcoming", "closed"] },
          },
        ],
        responses: {
          200: {
            description: "รายชื่อสถานประกอบการ",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Company" },
                    },
                    total: { type: "integer", example: 102 },
                  },
                },
              },
            },
          },
          400: { description: "status ไม่ถูกต้อง" },
          500: { description: "เกิดข้อผิดพลาดที่ server" },
        },
      },
    },
    "/api/companies/{id}": {
      get: {
        tags: ["Companies"],
        summary: "ดึงรายละเอียดสถานประกอบการ",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", example: 4 },
          },
        ],
        responses: {
          200: {
            description: "รายละเอียดสถานประกอบการ",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Company" },
              },
            },
          },
          400: { description: "id ไม่ถูกต้อง" },
          404: { description: "ไม่พบสถานประกอบการ" },
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
      Company: {
        type: "object",
        properties: {
          id: { type: "integer", example: 4 },
          name: { type: "string", example: "ธนาคารกรุงเทพ จำกัด (มหาชน)" },
          logo: { type: "string", nullable: true, example: "C04.jpg" },
          description: { type: "string", nullable: true },
          province: { type: "string", example: "กรุงเทพมหานคร" },
          location: { type: "string", nullable: true },
          application_start: { type: "string", format: "date", nullable: true, example: "2026-10-01" },
          application_end: { type: "string", format: "date", nullable: true, example: "2026-12-31" },
          positions: {
            type: "array",
            items: { $ref: "#/components/schemas/Position" },
          },
        },
      },
      Position: {
        type: "object",
        properties: {
          name: { type: "string", example: "Software Developer Intern" },
          description: { type: "string", nullable: true },
          quota: { type: "integer", nullable: true, example: 2 },
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