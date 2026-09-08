const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// =======================
// CONFIGURABLE VALUES 
// =======================
const PORT = process.env.PORT || 5000;
const APP_ENV = process.env.APP_ENV || 'Development';
const MAX_RESULTS = parseInt(process.env.MAX_RESULTS) || 150; 

// โหลดข้อมูล Mock Data เข้ามาใน Memory
const dataPath = path.join(__dirname, 'data', 'mockfile.json');
let companiesData = [];

try {
  const rawData = fs.readFileSync(dataPath, 'utf8');
  companiesData = JSON.parse(rawData);
  console.log(`[Backend] Loaded ${companiesData.length} companies successfully.`);
} catch (error) {
  console.error('[Backend] Error loading mockfile.json:', error);
}

// ----------------------------------------------------------
// API Endpoint 1: ดึงสถานะระบบและ Config (สำหรับพรีเซนต์เรื่อง Config)
// ----------------------------------------------------------
app.get('/api/config', (req, res) => {
  res.json({
    environment: APP_ENV,
    maxResultsLimit: MAX_RESULTS,
    totalRecords: companiesData.length
  });
});

// ----------------------------------------------------------
// API Endpoint 2: ดึงรายชื่อจังหวัดทั้งหมดที่ไม่ซ้ำกัน (สำหรับ Dropdown Filter)
// ----------------------------------------------------------
app.get('/api/provinces', (req, res) => {
  const provinces = companiesData.map((c) => c.province).filter(Boolean);
  const uniqueProvinces = [...new Set(provinces)];
  
  res.json({
    status: 'success',
    data: uniqueProvinces
  });
});

// ----------------------------------------------------------
// API Endpoint 3: ค้นหาและกรองข้อมูล (Dynamic Behavior / Search Filter)
// ----------------------------------------------------------
app.get('/api/companies', (req, res) => {
  const { search = '', province = '' } = req.query;

  let filtered = companiesData.filter((company) => {
    const matchText =
      company.name.toLowerCase().includes(search.toLowerCase()) ||
      (company.description && company.description.toLowerCase().includes(search.toLowerCase())) ||
      (company.location && company.location.toLowerCase().includes(search.toLowerCase())) ||
      (company.positions && company.positions.toLowerCase().includes(search.toLowerCase()));

    const matchProvince = province === '' || company.province === province;

    return matchText && matchProvince;
  });

  // ใช้ค่า Config (MAX_RESULTS) ในการจำกัดจำนวนผลลัพธ์
  const limitedResults = filtered.slice(0, MAX_RESULTS);

  res.json({
    status: 'success',
    environment: APP_ENV,
    count: limitedResults.length,
    totalFound: filtered.length,
    data: limitedResults
  });
});

// รัน Server
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`Server running in [${APP_ENV}] mode`);
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`=================================`);
});