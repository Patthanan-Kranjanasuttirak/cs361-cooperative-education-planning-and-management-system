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
    (company.province && company.province.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (company.positions && company.positions.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getDisplayLocation = (company) => {
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
    <div className="company-page-container">
      {/* Header Container */}
      <Navbar />
      
      <div className="company-container">
        {/* Back button */}
        <div className="company-header-top">
          <button
            onClick={() => navigate('/')}
            className="back-link-btn"
          >
            ← กลับหน้าหลัก
          </button>
        </div>

        {/* Title and Search Bar Row */}
        <header className="company-header">
          <div className="company-title-group">
            <h1 className="company-title">
              รายชื่อสถานประกอบการ
            </h1>
            <p className="company-subtitle">รายชื่อและรายละเอียดข้อมูลสถานประกอบการสำหรับสหกิจศึกษา</p>
          </div>

          {/* Search Bar for Company Page */}
          <div className="company-search-bar">
            <img src={searchIcon} alt="search" className="company-search-icon" />
            <input
              type="text"
              placeholder="ค้นหาสถานประกอบการ"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="company-search-input"
            />
          </div>
        </header>

        {/* List Grid Container */}
        <div className="company-list-container">
          {filteredCompanies.length > 0 ? (
            filteredCompanies.map((company) => (
              <div
                key={company.id}
                onClick={() => setSelectedCompany(company)}
                className="company-card-item"
              >
                {/* Top: Logo Box */}
                <div className="company-card-logo-box">
                  {company.logo ? (
                    <img src={getImageUrl(company.logo)} alt={company.name} className="company-card-logo-img" />
                  ) : (
                    <span className="company-card-logo-emoji">🏢</span>
                  )}
                </div>

                {/* Details */}
                <div className="company-card-details">
                  <h2 className="company-card-name">{company.name}</h2>
                  <p className="company-card-desc">{company.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>

                  {/* Meta details */}
                  <div className="company-card-meta">
                    <img src={locationIcon} alt="pin" className="company-meta-icon" />
                    <span>{getDisplayLocation(company)}</span>
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

