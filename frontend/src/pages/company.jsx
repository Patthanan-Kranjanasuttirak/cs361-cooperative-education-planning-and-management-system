import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/image';
import { fetchCompanies } from '../services/companyApi';
import ApplicationBadge from '../components/ApplicationBadge';
import { APPLICATION_STATUSES } from '../utils/applicationPeriod';
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
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [companies, setCompanies] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [positions, setPositions] = useState([]);
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
          {
            search: searchTerm,
            province: selectedProvince,
            position: selectedPosition,
            status: selectedStatus,
          },
          controller.signal
        );
        setCompanies(data);
        setLoadError(null);

        // ผลลัพธ์แบบไม่กรองคือข้อมูลทั้งหมด ใช้สร้างตัวเลือกจังหวัด ตำแหน่ง และจำนวนรวม
        if (!searchTerm.trim() && !selectedProvince && !selectedPosition && !selectedStatus) {
          setTotalCount(data.length);
          setProvinces(sortByCount(data.map((company) => company.province)));
          setPositions(
            sortByCount(data.flatMap((company) => (company.positions ?? []).map((p) => p.name)))
          );
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
  }, [searchTerm, selectedProvince, selectedPosition, selectedStatus]);

  const isFiltering =
    searchTerm !== '' || selectedProvince !== '' || selectedPosition !== '' || selectedStatus !== '';
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedProvince('');
    setSelectedPosition('');
    setSelectedStatus('');
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

          {/* ด้านขวาของหัวข้อ: Search แล้วตามด้วย Filters */}
          <div className="company-filter-group">
            <div className="company-search-bar">
              <img src={searchIcon} alt="search" className="company-search-icon" />
              <input
                type="text"
                placeholder="ค้นหาสถานประกอบการหรือตำแหน่งงาน"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="company-search-input"
              />
            </div>
            <div className="company-filter-selects">
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

              <select
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="company-filter-select"
                aria-label="กรองตามตำแหน่งงาน"
              >
                <option value="">ทุกตำแหน่ง</option>
                {positions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="company-filter-select"
                aria-label="กรองตามสถานะการรับสมัคร"
              >
                <option value="">ทุกสถานะการรับสมัคร</option>
                {Object.entries(APPLICATION_STATUSES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
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

                  {/* Application status & positions */}
                  <div className="company-card-tags">
                    <ApplicationBadge company={company} />
                  </div>

                  {company.positions?.length > 0 && (
                    <div className="company-card-positions">
                      {company.positions.map((position) => (
                        <span
                          key={position.name}
                          className={`position-chip position-chip--${getPositionColor(position.name)}`}
                        >
                          {getShortPositionName(position.name)}
                        </span>
                      ))}
                    </div>
                  )}

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

// ค่าที่ไม่ซ้ำกัน เรียงตามจำนวนที่พบมากไปน้อย (ใช้สร้างตัวเลือกจังหวัดและตำแหน่ง)
function sortByCount(values) {
  const counts = values.reduce((acc, value) => {
    const key = value?.trim();
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b, 'th'));
}

// ชื่อตำแหน่งแบบสั้นสำหรับแสดงบนการ์ด เช่น "Data Analyst Intern" → "Data Analyst"
function getShortPositionName(name) {
  return name.replace(/\s*Intern$/i, '');
}

// สีของป้ายตำแหน่งตามประเภทงาน (ตำแหน่งที่ไม่ตรงกลุ่มไหนได้สีเทา)
// (เรียงตามลำดับ ตรงกลุ่มแรกก่อน เช่น "Cloud / DevOps Engineer" ต้องได้สี cloud ไม่ใช่ developer)
const POSITION_COLORS = [
  [/cloud|devops/i, 'orange'],
  [/developer|engineer/i, 'blue'],
  [/qa|tester/i, 'purple'],
  [/data/i, 'teal'],
  [/\bai\b|machine learning/i, 'pink'],
  [/security/i, 'red'],
  [/business analyst/i, 'indigo'],
  [/ux|ui|design/i, 'yellow'],
];
function getPositionColor(name) {
  return POSITION_COLORS.find(([pattern]) => pattern.test(name))?.[1] ?? 'gray';
}
