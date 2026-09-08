# CS361 Backend API Service

บริการ Backend API สำหรับประมวลผล ค้นหา และกรองข้อมูลสถานประกอบการ (Search & Filter Dynamic Behavior) พร้อมรองรับการตั้งค่าผ่าน Configuration บน Compute Layer

---

## 🛠️ โครงสร้างและการทำงานของระบบ (Architecture & Features)

Backend พัฒนาด้วย **Node.js + Express** ทำหน้าที่เป็น RESTful API สำหรับประมวลผลข้อมูลในลักษณะ **In-Memory Data Processing** โดยมีรายละเอียดส่วนประกอบดังนี้:

### 1. Dynamic Search & Filter Behavior
* **Province Filter:** รองรับการกรองตามรายชื่อจังหวัด (`province`)
* **Provinces Endpoint:** ดึงรายชื่อจังหวัดทั้งหมดที่ไม่ซ้ำกัน (`uniqueProvinces`) สำหรับใช้ทำ Dropdown บน Frontend

### 2. Configurable Environment (Compute Layer Readiness)
ควบคุมพฤติกรรมของแอปพลิเคชันผ่านตัวแปร Environment Variables (`.env`) โดยไม่ต้องแก้ไขโค้ด:
* `PORT`: พอร์ตที่ใช้รันเซิร์ฟเวอร์ (Default: `5000`)
* `APP_ENV`: สถานะสภาพแวดล้อมระบบ เช่น `Local-Dev`, `Production`
* `MAX_RESULTS`: จำกัดจำนวนผลลัพธ์สูงสุดที่ส่งกลับไปยัง Frontend 

---

## 📡 API Endpoints

| Method | Endpoint | Description | Query Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/config` | ตรวจสอบสถานะระบบและค่า Configuration ปัจจุบัน | N/A |
| `GET` | `/api/provinces` | ดึงรายชื่อจังหวัดทั้งหมดที่มีในระบบแบบไม่ซ้ำกัน | N/A |
| `GET` | `/api/companies` | ค้นหาและกรองข้อมูลบริษัทตามเงื่อนไข | `search` (ข้อความค้นหา), `province` (ชื่อจังหวัด) |

---

## 🚀 ขั้นตอนการติดตั้งและการรันครั้งแรก (Step-by-Step)

### 1. ข้อกำหนดเบื้องต้น (Prerequisites)
* ติดตั้ง [Node.js](https://nodejs.org/) (เวอร์ชัน 18 ขึ้นไป) บนเครื่องเรียบร้อยแล้ว

### 2. การเข้าสู่โฟลเดอร์ Backend
เปิด Terminal ใน VS Code หรือ Command Line แล้วเข้าไปที่โฟลเดอร์ `backend`:
```bash
cd backend
```

### 3. ติดตั้ง Dependencies (ทำเฉพาะครั้งแรก)
ดาวน์โหลดแพ็กเกจที่จำเป็น (express, cors, dotenv):

```bash
npm install
```

### 4. การตั้งค่า Environment File (.env)
สร้างไฟล์ชื่อ .env ในโฟลเดอร์ backend แล้วใส่ค่าเริ่มต้นดังนี้:

```bash
PORT=5000
APP_ENV=Local-Dev
MAX_RESULTS=150
```

### 5. การรันระบบ (Running Server)
การรันโหมดปกติ:

```bash
node server.js
(หรือ npm start )
```

ผลลัพธ์เมื่อรันสำเร็จ:
Terminal จะแสดงข้อความยืนยันการโหลดข้อมูลและพอร์ตที่ใช้งาน:

```bash
🧪 การทดสอบระบบ (Testing)
สามารถทดสอบ API ผ่านเบราว์เซอร์หรือ Postman ได้ทันทีที่ URL ต่อไปนี้:

ตรวจสอบ Config: http://localhost:5000/api/config

ตรวจสอบรายชื่อจังหวัด: http://localhost:5000/api/provinces

ทดสอบค้นหาและกรอง: http://localhost:5000/api/companies?search=กสิกร&province=นนทบุรี