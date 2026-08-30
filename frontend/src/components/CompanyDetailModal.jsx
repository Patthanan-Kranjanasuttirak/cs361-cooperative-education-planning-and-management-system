import { useEffect } from 'react';
import locationIcon from '../assets/location.png';
import './CSS/CompanyDetailModal.css';

export default function CompanyDetailModal({ company, onClose }) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';

    // Escape key press handler
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!company) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal-backdrop"
        onClick={onClose}
      />
      <div className="modal-content">

        <button
          onClick={onClose}
          className="modal-close-btn"
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="modal-header-banner">
          <h2 className="modal-company-name">{company.name}</h2>
        </div>

        <div className="modal-body">

          <div className="modal-section">
            <h3 className="modal-section-title">รายละเอียด</h3>
            <p className="modal-description-box">
              {company.description || 'ไม่มีข้อมูลรายละเอียดเพิ่มเติมสำหรับสถานประกอบการนี้'}
            </p>
          </div>

          <div className="modal-divider-section">
            <div className="modal-info-row">
              <span className="modal-info-label">
                <img src={locationIcon} alt="province" className="modal-info-icon" />
                จังหวัดที่ปฏิบัติงาน
              </span>
              <span className="modal-info-value">{company.province || 'ไม่ระบุ'}</span>
            </div>
          </div>

          <div className="modal-divider-section">
            <div className="modal-info-row">
              <span className="modal-info-label">
                <img src={locationIcon} alt="location" className="modal-info-icon" />
                รายละเอียดสถานที่ปฏิบัติงาน
              </span>
              <span className="modal-info-value">{company.location || 'ไม่ระบุ'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            onClick={onClose}
            className="modal-footer-btn"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
}


