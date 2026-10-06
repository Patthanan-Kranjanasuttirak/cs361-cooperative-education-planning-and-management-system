// เรียกข้อมูลสถานประกอบการจาก API (API Gateway → Lambda)
// ตั้งค่า URL ผ่าน VITE_API_URL เช่น https://xxxx.execute-api.ap-southeast-1.amazonaws.com/prod
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(path, signal) {
  if (!API_URL) {
    throw new Error('ยังไม่ได้ตั้งค่า VITE_API_URL');
  }

  const response = await fetch(`${API_URL}${path}`, { signal });
  if (!response.ok) {
    const error = new Error(`API error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

// GET /companies?search=&province=  → { data: [...], total }
export async function fetchCompanies({ search = '', province = '' } = {}, signal) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (province) params.set('province', province);
  const query = params.toString();

  const result = await request(`/companies${query ? `?${query}` : ''}`, signal);
  const companies = Array.isArray(result) ? result : result?.data;
  if (!Array.isArray(companies)) {
    throw new Error('รูปแบบข้อมูลจาก API ไม่ถูกต้อง');
  }
  return companies;
}

// GET /companies/{id}  → { id, name, ... } หรือ 404 ถ้าไม่พบ
export async function fetchCompany(id, signal) {
  try {
    return await request(`/companies/${encodeURIComponent(id)}`, signal);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}
