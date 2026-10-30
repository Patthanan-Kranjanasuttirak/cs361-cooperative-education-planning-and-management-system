import { cognitoEnabled, cognitoIdToken } from './cognito';

export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export function savedToken() {
  try { return JSON.parse(sessionStorage.getItem('coop-auth') ?? localStorage.getItem('coop-auth'))?.token; }
  catch { return null; }
}

// Cognito: ขอ token จาก Amplify ทุกครั้ง (ต่ออายุให้เอง), development: token ที่ backend ออกให้ตอน login
async function authToken() {
  if (!cognitoEnabled) return savedToken();
  try { return await cognitoIdToken(); } catch { return null; }
}

export async function api(path, { method = 'GET', body, signal, headers = {}, anonymous = false, blob = false } = {}) {
  const token = anonymous ? null : await authToken();
  const raw = body instanceof Blob;
  const response = await fetch(`${API_URL}${path}`, {
    method, signal,
    headers: { ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error?.message || data.message || `เรียกข้อมูลไม่สำเร็จ (${response.status})`);
    error.status = response.status;
    error.code = data.error?.code;
    error.details = data.error?.details;
    throw error;
  }
  return blob ? response.blob() : response.json();
}

// kind: transcript | resume | cv (PDF) หรือ photo (JPG/PNG)
export const uploadDocument = (file, kind) => api(`/documents?kind=${kind}`, { method: 'POST', body: file, headers: { 'Content-Type': kind === 'photo' ? file.type : 'application/pdf' } });
