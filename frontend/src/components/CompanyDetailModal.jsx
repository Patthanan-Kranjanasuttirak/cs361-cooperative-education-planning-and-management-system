import { useEffect } from 'react';
import { getImageUrl } from '../utils/image';
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

  const getDisplayProvince = (company) => {
    if (company.province && company.province.trim()) {
      return company.province;
    }
    if (company.location) {
      if (company.location.includes('กรุงเทพ')) return 'กรุงเทพมหานคร';
      if (company.location.includes('พหลโยธิน') || company.location.includes('คลองหลวง') || company.location.includes('ปทุมธานี')) return 'ปทุมธานี';
      return company.location;
    }
    return 'ไม่ระบุ';
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-backdrop"
        onClick={onClose}
      />
      <div className="modal-content">

        {/* Top Header Banner with Orange Gradient */}
        <div className="modal-header-banner">
          <button
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close modal"
          >
            ✕
          </button>

          <div className="modal-header-info">
            <div className="modal-logo-box">
              {company.logo ? (
                <img src={getImageUrl(company.logo)} alt={company.name} className="modal-logo-img" />
              ) : (
                <span className="modal-logo-emoji">🏢</span>
              )}
            </div>
            <h2 className="modal-company-name">{company.name}</h2>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="modal-body">
          <div className="modal-section">
            <span className="modal-section-title">รายละเอียด</span>
            <p className="modal-description-text">
              {company.description || 'ไม่มีข้อมูลรายละเอียดเพิ่มเติมสำหรับสถานประกอบการนี้'}
            </p>
          </div>

          <div className="modal-info-row">
            <span className="modal-info-label">
              <img src={locationIcon} alt="province" className="modal-info-icon" />
              จังหวัดที่ปฏิบัติงาน
            </span>
            <span className="modal-info-value">{getDisplayProvince(company)}</span>
          </div>

          <div className="modal-info-row">
            <span className="modal-info-label">
              <img src={locationIcon} alt="location" className="modal-info-icon" />
              สถานที่ปฏิบัติงาน
            </span>
            <span className="modal-info-value modal-location-value">
              {company.location || 'ไม่ระบุ'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}



