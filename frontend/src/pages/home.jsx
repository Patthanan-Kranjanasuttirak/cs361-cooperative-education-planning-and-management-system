import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import companiesData from '../data/mockfile.json';
import CompanyDetailModal from '../components/CompanyDetailModal';
import './CSS/home.css';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);

  const navigate = useNavigate();
  const { id } = useParams();

  // Watch for id in URL to open modal
  useEffect(() => {
    if (id) {
      const company = companiesData.find((c) => c.id === parseInt(id));
      if (company) {
        setSelectedCompany(company);
      } else {
        setSelectedCompany(null);
        navigate('/', { replace: true });
      }
    } else {
      setSelectedCompany(null);
    }
  }, [id, navigate]);

  const handleCloseModal = () => {
    setSelectedCompany(null);
    if (id) {
      navigate('/');
    }
  };

  const filteredCompanies = companiesData.filter((company) =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="home-container">
      {/* Header ระบบ */}
      <header className="home-header">
        <h1 className="home-title">
          ระบบจัดการแผนสหกิจศึกษา
        </h1>
        <p className="home-subtitle">
          Cooperative Education Planning & Management System
        </p>
      </header>

      {/* Search Bar */}
      <div className="home-search-bar">
        <span className="home-search-icon">🔍</span>
        <input
          type="text"
          placeholder="ค้นหาสถานประกอบการ หรือชื่อบริษัท..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="home-search-input"
        />
      </div>

      {/* เกณฑ์การประเมิน Section */}
      <section className="criteria-section">
        <div className="criteria-header">
          <h2 className="criteria-title">
            📋 เกณฑ์การประเมินสหกิจศึกษา
          </h2>
          <span className="criteria-more-link">รายละเอียดเพิ่มเติม</span>
        </div>
        <ul className="criteria-list">
          <li className="criteria-item">
            <span className="criteria-check">✓</span>
            <span>ผ่านการอบรมเตรียมความพร้อมสหกิจศึกษา</span>
          </li>
          <li className="criteria-item">
            <span className="criteria-check">✓</span>
            <span>หน่วยกิตสะสมไม่น้อยกว่า 90 หน่วยกิต</span>
          </li>
          <li className="criteria-item">
            <span className="criteria-check">✓</span>
            <span>เกรดเฉลี่ยสะสม (GPAX) ผ่านตามเกณฑ์คณะ</span>
          </li>
        </ul>
      </section>

      {/* MOU สถานประกอบการ Section */}
      <section className="mou-section">
        {/* Header */}
        <div className="mou-header">
          <h2 className="mou-subtitle">MOU</h2>
          <h3 className="mou-title">สถานประกอบการ</h3>
        </div>

        {/* Logos Flex Container */}
        <div className="company-logo-grid">
          {filteredCompanies.slice(0, 6).map((company) => (
            <div
              key={company.id}
              className="company-logo-card"
              title={company.name}
            >
              {company.logo ? (
                <img
                  src={company.logo}
                  alt={company.name}
                  className="company-logo-img"
                />
              ) : (
                <div className="company-logo-placeholder">
                  <span className="placeholder-icon">🏢</span>
                  <span className="placeholder-name">{company.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Subtitle Link */}
        <button
          onClick={() => navigate('/company')}
          className="view-more-btn"
        >
          คลิกเพื่อดูเพิ่มเติม
        </button>
      </section>

      {/* Company Detail Modal */}
      {selectedCompany && (
        <CompanyDetailModal
          company={selectedCompany}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}