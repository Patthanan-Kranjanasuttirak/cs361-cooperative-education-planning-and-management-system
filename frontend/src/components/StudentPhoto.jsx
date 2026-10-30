import { useEffect, useState } from 'react';
import { api } from '../services/api';
import './CSS/StudentPhoto.css';

// รูปนักศึกษา: ไฟล์ที่เพิ่งเลือก (file) หรือรูปที่บันทึกไว้ (s3Key ต้องโหลดพร้อม token เหมือนเอกสารอื่น)
export default function StudentPhoto({ s3Key, file, alt = 'รูปนักศึกษา' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url = null;
    let cancelled = false;
    const show = (blob) => { if (!cancelled) { url = URL.createObjectURL(blob); setSrc(url); } };
    if (file) show(file);
    else if (s3Key) api(`/documents/${encodeURIComponent(s3Key)}`, { blob: true }).then(show).catch(() => !cancelled && setSrc(null));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [s3Key, file]);
  // ไม่มีทั้งไฟล์และรูปที่บันทึกไว้ = ไม่แสดงรูปเดิมที่ค้างอยู่
  return src && (file || s3Key) ? <img src={src} alt={alt} className="student-photo" /> : <span className="student-photo student-photo--empty">ไม่มีรูป</span>;
}
