import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/image';
import { fetchCompanies } from '../services/companyApi';
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
  const [selectedProvince, setSelectedProvince] = useState('');
  const [companies, setCompanies] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // ค้นหา/กรองผ่าน API (รอให้หยุดพิมพ์ 300ms ก่อนค่อยเรียก)
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await fetchCompanies(
          { search: searchTerm, province: selectedProvince },
          controller.signal
        );
        setCompanies(data);
        setLoadError(null);

        // ผลลัพธ์แบบไม่กรองคือข้อมูลทั้งหมด ใช้สร้างรายชื่อจังหวัดและจำนวนรวม
        if (!searchTerm.trim() && !selectedProvince) {
          setTotalCount(data.length);
          setProvinces(getProvinces(data));
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Error fetching companies:', error);
        setLoadError(error);
        setCompanies([]);
      }
      setIsLoading(false);
    }, searchTerm ? 300 : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, selectedProvince]);

  const isFiltering = searchTerm !== '' || selectedProvince !== '';
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedProvince('');
  };

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

          <div className="company-filter-group">
            {/* Province Filter */}
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="company-filter-select"
              aria-label="กรองตามจังหวัด"
            >
              <option value="">ทุกจังหวัด</option>
              {provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>

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
          </div>
        </header>

        {/* Result count */}
        <div className="company-result-bar">
          <span>
            {isLoading
              ? 'กำลังโหลดข้อมูล…'
              : `พบ ${companies.length} จาก ${totalCount} สถานประกอบการ`}
          </span>
          {isFiltering && (
            <button onClick={clearFilters} className="company-clear-filter-btn">
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* List Grid Container */}
        <div className="company-list-container">
          {companies.length > 0 ? (
            companies.map((company) => (
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
                    <span className="company-card-logo-empty">ไม่พบรูปภาพ</span>
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
              <p className="company-empty-text">
                {isLoading
                  ? 'กำลังโหลดข้อมูล…'
                  : loadError
                    ? 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
                    : 'ไม่พบข้อมูลที่ค้นหา'}
              </p>
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

// รายชื่อจังหวัดทั้งหมด เรียงตามจำนวนบริษัทมากไปน้อย
function getProvinces(companies) {
  const provinceCounts = companies.reduce((counts, company) => {
    const province = company.province?.trim();
    if (province) counts[province] = (counts[province] || 0) + 1;
    return counts;
  }, {});
  return Object.keys(provinceCounts).sort(
    (a, b) => provinceCounts[b] - provinceCounts[a] || a.localeCompare(b, 'th')
  );
}
