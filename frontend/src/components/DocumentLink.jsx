import '../pages/CSS/pendingApplications.css';

// ลิงก์เปิดไฟล์ (เรซูเม่ / transcript) — url เป็น presigned URL ของ S3 ที่ backend ออกให้ ถ้ายังไม่มีไฟล์จะกดไม่ได้
export default function DocumentLink({ url, label }) {
  if (!url) {
    return (
      <span className="pending-doc pending-doc--missing" title="ยังไม่ได้เชื่อม S3">
        {label} (ยังไม่มีไฟล์)
      </span>
    );
  }
  return (
    <a className="pending-doc" href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}
