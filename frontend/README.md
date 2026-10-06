# 🎓 Cooperative Education Planning & Management System
ระบบจัดการแผนสหกิจศึกษา (โปรเจกต์รายวิชา CS361)

---

## 📁 Project Structure (โครงสร้างโฟลเดอร์)
อธิบายคร่าวๆ ว่าแต่ละโฟลเดอร์ทำหน้าที่อะไร:
- `src/assets/` : เก็บไฟล์ภาพในโปรเจค
- `src/components/` : เก็บ Component ย่อยที่ใช้ซ้ำในหน้าต่างๆ
- `src/data/` : เก็บไฟล์ข้อมูลจำลอง (เช่น `mockfile.json`)
- `src/pages/` : เก็บหน้าจอหลักของเว็บ เช่น `home.jsx` (หน้าแรก) และ `detail.jsx` (หน้ารายละเอียด)
- `src/routes/` : จัดการระบบเส้นทางและการเปลี่ยนหน้า (Routing ด้วย `react-router-dom`)
- `src/services/` : สำหรับเชื่อมต่อ API หรือดึงข้อมูลภายนอก 
- `src/utils/` : เก็บฟังก์ชันเสริมหรือตัวช่วยคำนวณต่างๆ

---

- `src/App.jsx`: เป็นคอมโพเนนต์หลักของแอปพลิเคชัน ทำหน้าที่เป็นตัวคุมโครงสร้างภาพรวมและเรียกใช้งานระบบเส้นทาง (Routing) ผ่าน approutes เพื่อสลับหน้าจอไปมาระหว่างหน้า Home และ Detail

- `src/main.jsx`: เป็นจุดเริ่มต้น (Entry Point) ของ React ที่ทำหน้าที่ดึงคอมโพเนนต์ App ไปเรนเดอร์ (Render) ใส่ลงในแท็ก <div id="root"></div> ของไฟล์ index.html เพื่อแสดงผลออกทางหน้าจอเบราว์เซอร์

---

## 🎨 การตกแต่งและเขียน Custom CSS เพิ่มเติม

โปรเจกต์นี้ใช้ **Tailwind CSS** ในการตกแต่งหน้าตาหลัก โดยหากต้องการเขียน CSS ปกติ (Custom CSS) เพิ่มเติมด้วยตัวเอง สามารถเขียนลงไปได้ที่:
- **`src/index.css`**: เป็นไฟล์ CSS กลางของโปรเจกต์ (ซึ่งตอนนี้มีคำสั่ง `@import "tailwindcss";` อยู่) สามารถเขียนคลาส CSS เพิ่มเติมต่อท้ายลงในไฟล์นี้ได้ทันที โดยจะมีผลใช้งานได้ทั่วทั้งโปรเจกต์

---

## ⚙️ How to Run Locally (วิธีรันโปรเจกต์ในเครื่อง)
ขั้นตอนการติดตั้งและรันเว็บสำหรับพัฒนา:

1. **Clone repository หรือดาวน์โหลดโปรเจกต์มาที่เครื่อง**
2. **ติดตั้งแพ็กเกจที่จำเป็น**
   เปิด Terminal ที่โฟลเดอร์โปรเจกต์ (หรือโฟลเดอร์ frontend) แล้วรันคำสั่ง:
   
```bash
   npm install
```

3. run local

```bash
   npm run dev
```

---

## 🔌 การเชื่อมต่อ API (`VITE_API_URL`)
หน้าเว็บดึงข้อมูลสถานประกอบการจาก API ผ่าน `src/services/companyApi.js` โดยอ่าน URL จากตัวแปร `VITE_API_URL`
ถ้าไม่ได้ตั้งค่า หรือเรียก API ไม่สำเร็จ หน้าเว็บจะแสดงข้อความ "ไม่สามารถโหลดข้อมูลได้"

1. สร้างไฟล์ `.env` จากตัวอย่าง แล้วแก้ค่า `VITE_API_URL`

```bash
   cp .env.example .env
```

2. เลือก API ที่จะใช้ (เปลี่ยนแค่ `VITE_API_URL` ไม่ต้องแก้โค้ด)

| ใช้กับ | ค่า `VITE_API_URL` |
|---|---|
| Mock API ในเครื่อง | `http://localhost:5099` |
| API Gateway จริง | `https://xxxx.execute-api.ap-southeast-1.amazonaws.com/prod` |

> แก้ `.env` แล้วต้องรัน `npm run dev` ใหม่ ส่วนตอน build ขึ้น S3 ค่า `VITE_API_URL` จะถูกฝังลงไปในไฟล์ ถ้าเปลี่ยน URL ต้อง build ใหม่

### 🧪 Mock API (ทดสอบโดยไม่ต้องมี Backend)
`mock-api.mjs` จำลอง API ตาม contract เดียวกับ Lambda โดยอ่านข้อมูลจาก `src/data/mockfile.json` (แก้ไฟล์แล้วเห็นผลทันที)

```bash
   # Terminal 1: เปิด Mock API ที่ http://localhost:5099
   npm run mock-api

   # Terminal 2: เปิดหน้าเว็บ (ตั้ง VITE_API_URL=http://localhost:5099 ใน .env)
   npm run dev
```

| Endpoint | ผลลัพธ์ |
|---|---|
| `GET /companies?search=&province=` | `200 { "data": [...], "total": 102 }` (ไม่ส่ง parameter = ทุกบริษัท) |
| `GET /companies/{id}` | `200 { id, name, logo, description, province, location }` หรือ `404` |

> Mock API ใช้สำหรับพัฒนาในเครื่องเท่านั้น ไม่ถูกรวมไปตอน `npm run build`

---

```bash
npm run build
```
คำสั่งสำหรับคอมไพล์และมัดรวมโค้ดทั้งหมดของโปรเจกต์ให้กลายเป็นไฟล์ใช้งานจริง (Production Build) โดยจะสร้างโฟลเดอร์ dist ขึ้นมา ซึ่งประกอบด้วยไฟล์ HTML, CSS และ JavaScript ที่ถูกย่อขนาดและพร้อมสำหรับนำไปอัปโหลดขึ้นเว็บเซิร์ฟเวอร์หรือ AWS S3 ทันที

---