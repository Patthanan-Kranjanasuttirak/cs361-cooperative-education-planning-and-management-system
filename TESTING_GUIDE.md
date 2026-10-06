# CS361 Cooperative Education Plan

รัน Frontend, Backend และ Database ด้วย Docker Compose คำสั่งเดียว

| ส่วน | เทคโนโลยี | พอร์ต (บนเครื่องเรา) |
|---|---|---|
| Frontend | React 19 + Vite | `5173` |
| Backend | Node.js 22 + Express + `pg` | `5000` |
| Database | PostgreSQL 17 | `5432` |

## โครงสร้างโปรเจกต์

```
.
├── docker-compose.yml     # รวมทั้ง 3 service
├── .env.example           # ตัวอย่างตัวแปรสภาพแวดล้อม
├── .env                   # ค่าจริง (ห้าม commit)
├── frontend/              # React + Vite (มี Dockerfile ของตัวเอง)
├── backend/               # Node.js API
└── database/              # PostgreSQL + สคริปต์สร้างตาราง
```

---

## วิธีรัน

**ต้องมี:** Docker Desktop (เปิดทิ้งไว้ก่อนรัน)

```bash
# 1. สร้างไฟล์ .env (ครั้งแรกครั้งเดียว) แล้วแก้รหัสผ่านตามต้องการ
cp .env.example .env

# 2. build และรันทั้งหมด
docker compose up --build
```

เมื่อรันสำเร็จ

| URL | ใช้ทำอะไร |
|---|---|
| http://localhost:5173 | หน้าเว็บ (Frontend) |
| http://localhost:5000/api/docs | **Swagger UI** ตรวจสอบและทดลองยิง API ทั้งหมดได้ที่นี่ |
| http://localhost:5000/api/docs.json | สเปค OpenAPI แบบ JSON (นำเข้า Postman ได้) |

### ตรวจสอบว่าระบบทำงานปกติ

เปิด http://localhost:5000/api/docs แล้วกด **Try it out → Execute** ที่แต่ละ endpoint

| Endpoint | ตรวจอะไร | ผลที่ควรได้ |
|---|---|---|
| `GET /api/health` | Backend ทำงานอยู่ไหม | `{"status":"ok"}` |
| `GET /api/db-check` | Backend ต่อ Database ได้ไหม | `{"database":"connected","now":"..."}` |
| `GET /api/users` | อ่านข้อมูลจากตารางได้ไหม | รายชื่อผู้ใช้ตัวอย่าง (Alice, Bob) |

- Swagger เช็ก Database ได้ทางอ้อมผ่าน `/api/db-check` และ `/api/users` เท่านั้น ถ้าต้องการดูหรือแก้ตารางโดยตรง ให้ดูหัวข้อ Database ด้านล่าง
- หน้า docs แสดงเฉพาะ endpoint ที่เขียนคำอธิบายไว้ใน `backend/src/config/swagger.js`
- ถ้า `/api/db-check` ขึ้น error ดู `docker compose logs backend` และตรวจค่า `DB_*` ใน `.env`
- ใช้ curl แทนได้ เช่น `curl http://localhost:5000/api/health` (PowerShell ให้ใช้ `curl.exe`)

### คำสั่งที่ใช้บ่อย

```bash
docker compose up --build -d      # รันเบื้องหลัง
docker compose ps                 # ดูสถานะ service
docker compose logs -f backend    # ดู log (เปลี่ยนเป็น frontend / database ได้)
docker compose restart backend    # รีสตาร์ทเฉพาะ service
docker compose down               # หยุดและลบ container (ข้อมูล DB ยังอยู่)
docker compose down -v            # หยุดและลบ volume ด้วย (ข้อมูล DB หายทั้งหมด)
```

### ตัวแปรใน `.env`

| ตัวแปร | ความหมาย | ค่าตัวอย่าง |
|---|---|---|
| `FRONTEND_PORT` | พอร์ตของหน้าเว็บบนเครื่องเรา | `5173` |
| `BACKEND_PORT` | พอร์ตของ Backend บนเครื่องเรา | `5000` |
| `DB_PORT` | พอร์ตของ Postgres บนเครื่องเรา | `5432` |
| `DB_NAME` | ชื่อฐานข้อมูล | `cs361_db` |
| `DB_USER` | ชื่อผู้ใช้ฐานข้อมูล | `postgres` |
| `DB_PASSWORD` | รหัสผ่านฐานข้อมูล (ต้องเปลี่ยน) | `your_secure_password_here` |
| `CORS_ORIGIN` | URL ของหน้าเว็บที่อนุญาตให้เรียก Backend | `http://localhost:5173` |

- `*_PORT` คือพอร์ตฝั่งเครื่องเรา (ฝั่งซ้ายของ `ports:`) ส่วนพอร์ตภายใน container คงที่ (frontend `5173`, backend `5000`, database `5432`) การเปลี่ยน `DB_PORT` จึงไม่กระทบการเชื่อมต่อระหว่าง Backend กับ Database
- `CORS_ORIGIN` ต้องตรงกับ URL ที่เปิดหน้าเว็บในเบราว์เซอร์ ถ้าเปลี่ยน `FRONTEND_PORT` ต้องแก้ให้ตรงกันด้วย (ถ้าไม่ตั้ง ค่าเริ่มต้นคือ `http://localhost:5173`)
- รหัสผ่านที่มีอักขระ `$` หรือ `#` ให้ครอบด้วยเครื่องหมายคำพูด เช่น `DB_PASSWORD="pa$$word"`
- เปลี่ยน `DB_USER` / `DB_PASSWORD` / `DB_NAME` หลังจากสร้าง volume ไปแล้ว จะไม่มีผลกับฐานข้อมูลเดิม ต้อง `docker compose down -v` ก่อน

---

## Backend (`backend/`)

```
backend/
├── Dockerfile            # Node 22 alpine, รัน npm run dev
├── .dockerignore         # ไม่ copy node_modules / .env เข้า image
├── package.json          # dependencies และ scripts
└── src/
    ├── app.js            # Express server (จุดเริ่มต้น)
    └── config/
        └── swagger.js    # คำอธิบาย API + ตั้งค่า Swagger UI
```

**Endpoint ปัจจุบัน**

| Method | Path | หน้าที่ |
|---|---|---|
| GET | `/api/health` | เช็กสถานะ server |
| GET | `/api/db-check` | เช็กการเชื่อมต่อ Database |
| GET | `/api/users` | ดึงรายชื่อผู้ใช้ |
| GET | `/api/docs` | หน้า Swagger UI (ปิดเมื่อ `NODE_ENV=production`) |
| GET | `/api/docs.json` | สเปค OpenAPI แบบ JSON |

**ข้อควรรู้**

- แก้โค้ดใน `backend/` แล้ว server รีสตาร์ทเอง (`node --watch` + mount โฟลเดอร์เข้า container)
- Backend เชื่อม Database ด้วย host ชื่อ **`database`** (ชื่อ service) ไม่ใช่ `localhost`
- ค่าเชื่อมต่อ DB อ่านจาก environment ที่ `docker-compose.yml` ส่งให้ (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)

**เพิ่ม endpoint ใหม่:** เขียน route ใน `src/app.js` แล้วเพิ่มคำอธิบายใน `paths` ของ `src/config/swagger.js` เพื่อให้แสดงในหน้า `/api/docs`

**เพิ่ม package ใหม่**

```bash
# แก้ package.json (หรือ npm install ใน container) แล้วรัน
docker compose up --build -V backend
```

`-V` ทำให้ volume `node_modules` ถูกสร้างใหม่ ไม่เช่นนั้น package ใหม่จะไม่ปรากฏ

**ต่อยอดเมื่อโค้ดเริ่มเยอะ** แยก `src/app.js` ออกเป็นชั้นๆ โดยไม่ต้องแก้ Docker

```
backend/
└── src/
    ├── app.js
    ├── config/        # swagger.js, db.js, env.js
    ├── routes/        # กำหนด URL
    ├── controllers/   # รับ request / ส่ง response
    ├── services/      # business logic
    ├── models/        # SQL queries
    ├── middlewares/   # auth, error handler
    └── utils/
```

---

## Database (`database/`)

```
database/
├── Dockerfile        # FROM postgres:17-alpine + copy init/
└── init/
    └── 01-schema.sql # สร้างตารางและข้อมูลตัวอย่าง
```

**หลักการทำงาน**

- Postgres จะรันไฟล์ `.sql` ทุกไฟล์ใน `init/` **เรียงตามชื่อ** เฉพาะตอนสร้าง volume ครั้งแรก
- ข้อมูลเก็บใน named volume `pgdata` จึงไม่หายเมื่อ `docker compose down`

**ตารางปัจจุบัน**

| ตาราง | คอลัมน์ |
|---|---|
| `users` | `id`, `name`, `email` (unique), `created_at` |

### เพิ่มตารางใหม่

1. สร้างไฟล์ใหม่ใน `database/init/` เช่น `02-plans.sql` (ใช้ `CREATE TABLE IF NOT EXISTS` เสมอ)
2. ทำอย่างใดอย่างหนึ่ง

| กรณี | วิธี |
|---|---|
| ช่วงพัฒนา ข้อมูลทิ้งได้ | `docker compose down -v` แล้ว `docker compose up --build` |
| มีข้อมูลที่ต้องเก็บ | `docker compose exec -T database psql -U <DB_USER> -d <DB_NAME> < database/init/02-plans.sql` |

> ไฟล์ใหม่ใน `init/` จะไม่ถูกรันบน volume เดิมโดยอัตโนมัติ

### เข้าไปดู/แก้ฐานข้อมูลโดยตรง

```bash
docker compose exec database psql -U postgres -d cs361_db
```

คำสั่งที่ใช้บ่อยใน psql: `\dt` (ดูตาราง), `\d users` (ดูโครงสร้างตาราง), `\q` (ออก) หรือใช้โปรแกรมอย่าง DBeaver / pgAdmin ต่อที่ `localhost:5432` ด้วยค่าใน `.env`

---

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `port is already allocated` | พอร์ตชน เปลี่ยน `*_PORT` ใน `.env` (พอร์ต 80 บน Windows มักชนกับโปรแกรมอื่น เช่น IIS) |
| เว็บเรียก API แล้วขึ้น CORS error | `CORS_ORIGIN` ไม่ตรงกับ URL ที่เปิดอยู่ ตรวจค่าใน `.env` แล้ว `docker compose up -d backend` |
| Frontend แก้โค้ดแล้วไม่ refresh (Windows) | เพิ่มใน `vite.config.js`: `server: { host: true, watch: { usePolling: true } }` |
| Backend ต่อ DB ไม่ได้ | ตรวจว่าใช้ host `database` และรหัสผ่านตรงกับตอนสร้าง volume (ถ้าเปลี่ยนรหัสต้อง `down -v`) |
| แก้ `init/*.sql` แล้วไม่มีผล | สคริปต์รันแค่ครั้งแรก ดูหัวข้อ "เพิ่มตารางใหม่" |
| เพิ่ม package แล้ว `Cannot find module` | รัน `docker compose up --build -V backend` |