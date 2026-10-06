// Mock API สำหรับทดสอบหน้าเว็บในเครื่อง (ใช้แทน API Gateway → Lambda ระหว่างพัฒนา)
// ตอบตาม API contract เดียวกับ Lambda:
//   GET /companies?search=&province=  → 200 { data: [...], total }
//   GET /companies/{id}               → 200 { ... } หรือ 404
// วิธีใช้: npm run mock-api แล้วตั้ง VITE_API_URL=http://localhost:5099
import http from 'node:http';
import fs from 'node:fs';

const PORT = Number(process.env.MOCK_API_PORT) || 5099;
const dataFile = new URL('./src/data/mockfile.json', import.meta.url);

// อ่านไฟล์ใหม่ทุก request เพื่อให้แก้ mockfile.json แล้วเห็นผลทันทีโดยไม่ต้องรีสตาร์ท
function loadCompanies() {
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET') {
    return send(res, 405, { message: 'method not allowed' });
  }

  let companies;
  try {
    companies = loadCompanies();
  } catch (error) {
    console.error('[mock-api] อ่าน mockfile.json ไม่ได้:', error.message);
    return send(res, 500, { message: 'cannot read mock data' });
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /companies/{id}
  const detailMatch = url.pathname.match(/^\/companies\/([^/]+)$/);
  if (detailMatch) {
    const company = companies.find((c) => String(c.id) === detailMatch[1]);
    return company ? send(res, 200, company) : send(res, 404, { message: 'company not found' });
  }

  // GET /companies?search=&province=
  if (url.pathname === '/companies') {
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const province = url.searchParams.get('province') || '';

    const data = companies.filter((c) => {
      const matchesSearch =
        !search ||
        [c.name, c.description, c.location, c.province].some(
          (value) => value && value.toLowerCase().includes(search)
        );
      const matchesProvince = !province || c.province === province;
      return matchesSearch && matchesProvince;
    });

    return send(res, 200, { data, total: data.length });
  }

  send(res, 404, { message: 'not found' });
});

server.listen(PORT, () => {
  console.log(`[mock-api] พร้อมใช้งานที่ http://localhost:${PORT}/companies`);
});
