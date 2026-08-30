import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/image';
import companiesData from '../data/mockfile.json';
import locationIcon from '../assets/location.png';
import searchIcon from '../assets/search.png';
import CompanyDetailModal from '../components/CompanyDetailModal';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './CSS/company.css';

export default function Company() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);

  const filteredCompanies = companiesData.filter((company) =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.description && company.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (company.location && company.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (company.positions && company.positions.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="company-page-container">
      {/* Header Container */}
      <Navbar />
      <div className="company-container">
      <header className="company-header">
        <div>
          <button
            onClick={() => navigate('/')}
            className="back-link-btn"
          >
            ← กลับหน้าหลัก
          </button>
          <h1 className="company-title">
            รายชื่อสถานประกอบการ
          </h1>
          <p className="company-subtitle">รายชื่อและรายละเอียดข้อมูลสถานประกอบการสำหรับสหกิจศึกษา</p>
        </div>

        {/* Search Bar for Company Page */}
        <div className="company-search-bar">
          <span className="company-search-icon">🔍</span>
          <input
            type="text"
            placeholder="ค้นหาในหน้านี้..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="company-search-input"
          />
        </div>
      </header>

      {/* List Container */}
      <div className="company-list-container">
        {filteredCompanies.length > 0 ? (
          filteredCompanies.map((company) => (
            <div
              key={company.id}
              onClick={() => setSelectedCompany(company)}
              className="company-card-item"
            >
              {/* Logo Box */}
              <div className="company-card-logo-box">
                {company.logo ? (
                  <img src={getImageUrl(company.logo)} alt={company.name} className="company-card-logo-img" />
                ) : (
                  <span className="company-card-logo-emoji">🏢</span>
                )}
              </div>

              {/* Details Column */}
              <div className="company-card-details">
                <div>
                  <h2 className="company-card-name">{company.name}</h2>
                  <p className="company-card-desc">{company.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                </div>

                {/* Meta details */}
                <div className="company-card-meta">
                  <span className="company-meta-item">
                    <img src={locationIcon} alt="pin" className="company-meta-icon" />
                    {company.location || 'ไม่ระบุ'}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="company-empty-state">
            <div>
              <img src={searchIcon} alt="search" className="company-empty-icon" />
            </div>
            <p className="company-empty-text">ไม่พบข้อมูลที่ค้นหา</p>
          </div>
        )}
      </div>

      {selectedCompany && (
        <CompanyDetailModal
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </div>
    <Footer />
  </div>
  );
}
