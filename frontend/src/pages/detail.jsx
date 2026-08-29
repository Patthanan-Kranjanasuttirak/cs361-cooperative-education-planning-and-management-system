import { useParams, useNavigate } from 'react-router-dom';
import companiesData from '../data/mockfile.json';
import './CSS/detail.css';

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const company = companiesData.find((c) => c.id === parseInt(id));

  if (!company) {
    return (
      <div className="detail-not-found-container">
        <p className="detail-not-found-text">ไม่พบข้อมูลสถานประกอบการ</p>
        <button
          onClick={() => navigate('/')}
          className="detail-not-found-btn"
        >
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  return (
    <div className="detail-page-container">
      <div className="detail-card">

        {/* ปุ่มย้อนกลับ */}
        <button
          onClick={() => navigate('/')}
          className="detail-back-btn"
        >
          ← กลับหน้าหลัก
        </button>

        {/* แบนเนอร์จำลอง */}
        <div className="detail-banner">
          {company.name}
        </div>

        <h1 className="detail-title">{company.name}</h1>
        <p className="detail-subtitle">รายละเอียดสถานประกอบการ</p>

        <div className="detail-info-box">
          <p className="detail-info-row">
            <strong className="detail-info-label">รายละเอียด :</strong>
            <span className="detail-info-value">{company.description}</span>
          </p>
          <p className="detail-info-row">
            <strong className="detail-info-label">สถานที่ฝึกงาน :</strong>
            <span className="detail-info-value">{company.location}</span>
          </p>
        </div>

        <div className="detail-actions">
          <button
            onClick={() => navigate('/')}
            className="detail-close-btn"
          >
            ปิด / ย้อนกลับ
          </button>
        </div>

      </div>
    </div>
  );
}