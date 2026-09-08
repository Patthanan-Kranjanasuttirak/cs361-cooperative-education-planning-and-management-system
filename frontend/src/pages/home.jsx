import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getImageUrl } from '../utils/image';
import CompanyDetailModal from '../components/CompanyDetailModal';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import bannerImage from '../assets/DomeBuilding.JPG';
import rightArrow from '../assets/right-arrow.png';
import searchIcon from '../assets/search.png';
import PiechartIcon from '../assets/pie-chart 1.png';
import './CSS/home.css';

export default function home() {
  const [companies, setCompanies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [provinces, setProvinces] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);

  const navigate = useNavigate();
  const { id } = useParams();

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

  useEffect(() => {
    if (id && companies.length > 0) {
      const company = companies.find((c) => c.id === parseInt(id));
      if (company) {
        setSelectedCompany(company);
      } else {
        setSelectedCompany(null);
        navigate('/', { replace: true });
      }
    } else {
      setSelectedCompany(null);
    }
  }, [id, navigate, companies]);

  const handleCloseModal = () => {
    setSelectedCompany(null);
    if (id) {
      navigate('/');
    }
  };

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
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="home-search-select"
            >
              <option value="">ทุกพื้นที่</option>
              {provinces.map((province, index) => (
                <option key={index} value={province}>
                  {province}
                </option>
              ))}
            </select>
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
        <section className="criteria-section">
          <div className="criteria-main-header">
            <h2 className="criteria-main-title">
              เกณฑ์รับสมัครเข้าแผน<span className="criteria-highlight">สหกิจศึกษา</span>
            </h2>
            <div className="criteria-academic-year">ปีการศึกษา 2568</div>
            <p className="criteria-subtitle">
              นักศึกษาสาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.ธรรมศาสตร์
            </p>
          </div>

          <div className="criteria-box base-qualification-box">
            <img src={PiechartIcon} alt="PiechartIcon" className="criteria-icon" />
            <div className="base-qual-content">
              <p className="base-qual-title">คุณสมบัติพื้นฐาน</p>
              <p className="base-qual-desc">
                GPAX สะสม : ไม่ต่ำกว่า <strong>2.75</strong> (คำนวณเมื่อสิ้นภาคการศึกษาฤดูร้อน)
                <br /> พฤติกรรม : มีความประพฤติดี ไม่เคยถูกลงโทษทางวินัยนักศึกษา
              </p>
            </div>
          </div>

          <div className="curriculum-grid">
            <div className="curriculum-card card-61">
              <div className="curriculum-badge badge-61">หลักสูตร 61</div>
              <div className="curriculum-body">
                <div className="curriculum-group">
                  <h4 className="curriculum-group-title">
                    วิชาบังคับพื้นฐาน <span className="title-sub">(เกรดเฉลี่ยกลุ่มไม่ต่ำกว่า 2.5)</span> :
                  </h4>
                  <p className="curriculum-courses">
                    คพ.100, คพ.111,(คพ.213 หรือ 216), คพ.251, คพ.264
                  </p>
                </div>
                <div className="curriculum-group">
                  <h4 className="curriculum-group-title">วิชาเลือก/หมวดวิชา</h4>
                  <p className="curriculum-courses">
                    คพ.384 และ (คพ.266 หรือ 322 หรือ 348)
                  </p>
                </div>
                <div className="curriculum-group">
                  <h4 className="curriculum-group-title">วิชาที่ต้องสอบได้ก่อนปฏิบัติงานจริง</h4>
                  <div className="prereq-tags">
                    <span className="prereq-tag tag-61">คพ.302</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="curriculum-card card-66">
              <div className="curriculum-badge badge-66">หลักสูตร 66</div>
              <div className="curriculum-body">
                <div className="curriculum-group">
                  <h4 className="curriculum-group-title">
                    วิชาบังคับพื้นฐาน <span className="title-sub">(เกรดเฉลี่ยกลุ่มไม่ต่ำกว่า 2.5)</span> :
                  </h4>
                  <p className="curriculum-courses">
                    คพ.100, คพ.101, คพ.102, คพ.111,(คพ.213 หรือ 216), คพ.251, คพ.261
                  </p>
                </div>
                <div className="curriculum-group">
                  <h4 className="curriculum-group-title">วิชาเลือก/หมวดวิชา</h4>
                  <p className="curriculum-courses">
                    คพ.180 และ (คพ.362 หรือ 333 หรือ 380)
                  </p>
                </div>
                <div className="curriculum-group">
                  <h4 className="curriculum-group-title">วิชาที่ต้องสอบได้ก่อนปฏิบัติงานจริง</h4>
                  <div className="prereq-tags">
                    <span className="prereq-tag tag-66">คพ.301</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="important-conditions-box">
            <h3 className="conditions-title">เงื่อนไขและข้อกำหนดสำคัญ</h3>
            <p className="conditions-desc">
              นักศึกษาต้องเตรียมความพร้อมและปฏิบัติตามระเบียบการฝึกอบรมสหกิจศึกษานั้น และจะไม่สามารถขอสถาบันหรือสถานประกอบการได้ หากคุณสมบัติไม่ครบถ้วน การคัดเลือกนักศึกษาเข้าทำงานขึ้นอยู่กับคณะกรรมการบริหารวิชาของสาขาวิชา จำนวนของนักศึกษาที่ให้สิทธิ์อาจปรับเปลี่ยนได้ตามจำนวนผู้ผ่านงานรายงานผล และการจัดฝึกอบรมผลงานการฝึกเป็นสำคัญ
            </p>
          </div>
        </section>

        {/* MOU สถานประกอบการ Section */}
        <section className="mou-section">
          <div className="mou-header">
            <h3 className="mou-title">สถานประกอบการ</h3>
          </div>

          <div className="company-logo-grid">
            {companies.slice(0, 8).map((company) => (
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

          <button
            onClick={() => navigate('/company')}
            className="view-more-btn"
          >
            คลิกเพื่อดูเพิ่มเติม
            <img src={rightArrow} alt="→" style={{ width: '18px', height: '18px' }} />
          </button>
        </section>
      </div>

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