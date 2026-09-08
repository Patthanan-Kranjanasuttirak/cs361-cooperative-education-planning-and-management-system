import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/image';
import locationIcon from '../assets/location.png';
import searchIcon from '../assets/search.png';
import CompanyDetailModal from '../components/CompanyDetailModal';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './CSS/company.css';

export default function company() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [provinces, setProvinces] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // ดึงรายชื่อจังหวัดทั้งหมดจาก Backend
  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/provinces');
        const result = await response.json();
        if (result.status === 'success') {
          setProvinces(result.data);
        }
      } catch (error) {
        console.error('Error fetching provinces:', error);
      }
    };

    fetchProvinces();
  }, []);

  // ดึงรายการบริษัทจากการค้นหาและจังหวัดผ่าน Backend API
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/companies?search=${encodeURIComponent(searchTerm)}&province=${encodeURIComponent(selectedProvince)}`
        );
        const result = await response.json();
        if (result.status === 'success') {
          setCompanies(result.data);
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };

    fetchCompanies();
  }, [searchTerm, selectedProvince]);

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
      <Navbar />
      
      <div className="company-container">
        <div className="company-header-top">
          <button
            onClick={() => navigate('/')}
            className="back-link-btn"
          >
            ← กลับหน้าหลัก
          </button>
        </div>

        <header className="company-header">
          <div className="company-title-group">
            <h1 className="company-title">
              รายชื่อสถานประกอบการ
            </h1>
            <p className="company-subtitle">รายชื่อและรายละเอียดข้อมูลสถานประกอบการสำหรับสหกิจศึกษา</p>
          </div>

          <div className="company-search-bar">
            <img src={searchIcon} alt="search" className="company-search-icon" />
            <input
              type="text"
              placeholder="ค้นหาสถานประกอบการ"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="company-search-input"
            />
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="company-search-select"
            >
              <option value="">ทุกพื้นที่</option>
              {provinces.map((province, index) => (
                <option key={index} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="company-list-container">
          {companies.length > 0 ? (
            companies.map((company) => (
              <div
                key={company.id}
                onClick={() => setSelectedCompany(company)}
                className="company-card-item"
              >
                <div className="company-card-logo-box">
                  {company.logo ? (
                    <img src={getImageUrl(company.logo)} alt={company.name} className="company-card-logo-img" />
                  ) : (
                    <span className="company-card-logo-emoji">🏢</span>
                  )}
                </div>

                <div className="company-card-details">
                  <h2 className="company-card-name">{company.name}</h2>
                  <p className="company-card-desc">{company.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>

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