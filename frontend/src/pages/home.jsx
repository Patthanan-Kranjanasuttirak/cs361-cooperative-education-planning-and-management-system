import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getImageUrl } from '../utils/image';
import companiesData from '../data/mockfile.json';
import CompanyDetailModal from '../components/CompanyDetailModal';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import bannerImage from '../assets/DomeBuilding.JPG';
import rightArrow from '../assets/right-arrow.png';
import searchIcon from '../assets/search.png';
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

      <Navbar />

      {/* Hero Banner */}
      <div className="home-banner">
        <img src={bannerImage} alt="Banner" className="home-banner-image" />
        <div className="home-banner-overlay">
          <h1 className="home-banner-title">
            สาขาวิชาวิทยาการคอมพิวเตอร์<br />มหาวิทยาลัยธรรมศาสตร์
          </h1>
          <div className="home-search-bar">
            <span className="home-search-icon"><img src={searchIcon} alt="Search" /></span>
            <input
              type="text"
              placeholder="ค้นหา"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="home-search-input"
            />
          </div>
        </div>
      </div>

      {/* Info Banner สีส้ม */}
      <div className="home-info-banner">
        <div className="home-info-banner-inner">
          <p className="home-info-banner-title">
            ศูนย์รวมข้อมูลสำหรับนักศึกษา อาจารย์ และสถานประกอบการเกี่ยวกับการแผนสหกิจศึกษา
          </p>
          <p className="home-info-banner-desc">
            หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยธรรมศาสตร์ พ.ศ. 2561 และ 2566
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="home-content">

        {/* เกณฑ์การประเมิน Section */}
        <section className="criteria-section">
          <div className="criteria-header">
            <h2 className="criteria-title">
              เกณฑ์
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
            <h3 className="mou-title">สถานประกอบการ</h3>
          </div>

          {/* Logos Grid */}
          <div className="company-logo-grid">
            {filteredCompanies.slice(0, 8).map((company) => (
              <div
                key={company.id}
                className="company-logo-card"
                title={company.name}
              >
                {company.logo ? (
                  <img
                    src={getImageUrl(company.logo)}
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

          {/* ปุ่มดูเพิ่มเติม */}
          <button
            onClick={() => navigate('/company')}
            className="view-more-btn"
          >
            คลิกเพื่อดูเพิ่มเติม
            <img src={rightArrow} alt="→" style={{ width: '18px', height: '18px' }} />
          </button>
        </section>

      </div>

      {/* Company Detail Modal */}
      {selectedCompany && (
        <CompanyDetailModal
          company={selectedCompany}
          onClose={handleCloseModal}
        />
      )}

      <Footer />
    </div>
  );
}