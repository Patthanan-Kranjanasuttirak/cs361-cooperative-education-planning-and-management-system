import DocumentLink from './DocumentLink';
import './CSS/CompanyFeedback.css';

// ข้อความ/ไฟล์ที่บริษัทแนบถึงนักศึกษาตอนตัดสินผลคัดเลือก
export default function CompanyFeedback({ app, title = 'ข้อความจากสถานประกอบการ' }) {
  if (!app.company_note && !app.company_file_url) return null;
  return (
    <div className="company-feedback">
      <p className="company-feedback-title">{title}</p>
      {app.company_note && <p className="company-feedback-note">{app.company_note}</p>}
      {app.company_file_url && <DocumentLink url={app.company_file_url} label="ดูไฟล์แนบจากบริษัท" />}
    </div>
  );
}
