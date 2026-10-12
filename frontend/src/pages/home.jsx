import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getImageUrl } from '../utils/image';
import { fetchCompanies, fetchCompany } from '../services/companyApi';
import CompanyDetailModal from '../components/CompanyDetailModal';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import bannerImage from '../assets/DomeBuilding.JPG';
import rightArrow from '../assets/right-arrow.png';
import searchIcon from '../assets/search.png';
import PiechartIcon from '../assets/pie-chart 1.png';
import './CSS/home.css';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  // รายชื่อทั้งหมด (ใช้แสดงโลโก้และเก็บรายชื่อจังหวัด) — null = ยังโหลดไม่เสร็จ
  const [allCompanies, setAllCompanies] = useState(null);
  const [allError, setAllError] = useState(null);
  // ผลค้นหาล่าสุด พร้อมคำค้นที่ใช้ (ถ้าคำค้นตอนนี้ไม่ตรงกับ term แปลว่ากำลังค้นหา)
  const [search, setSearch] = useState({ term: '', companies: [], error: null });
  const [reloadKey, setReloadKey] = useState(0);

  const navigate = useNavigate();
  const { id } = useParams();

  // Watch for id in URL to open modal (ดึงรายละเอียดจาก GET /companies/{id})
  useEffect(() => {
    if (!id) {
      setSelectedCompany(null);
      return;
    }

    const controller = new AbortController();
    fetchCompany(id, controller.signal)
      .then((company) => {
        if (company) {
          setSelectedCompany(company);
        } else {
          setSelectedCompany(null);
          navigate('/', { replace: true });
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') console.error('Error fetching company:', error);
      });

    return () => controller.abort();
  }, [id, navigate]);

  // โหลดรายชื่อทั้งหมดครั้งแรก (และเมื่อกด "ลองใหม่")
  useEffect(() => {
    const controller = new AbortController();
    fetchCompanies({}, controller.signal)
      .then((data) => {
        setAllCompanies(data);
        setAllError(null);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        console.error('Error fetching companies:', error);
        setAllError(error);
      });

    return () => controller.abort();
  }, [reloadKey]);

  // ค้นหาสถานประกอบการผ่าน API (รอให้หยุดพิมพ์ 300ms ก่อนค่อยเรียก)
  const term = searchTerm.trim();
  useEffect(() => {
    if (!term) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchCompanies({ search: term }, controller.signal)
        .then((data) => setSearch({ term, companies: data, error: null }))
        .catch((error) => {
          if (error.name === 'AbortError') return;
          console.error('Error searching companies:', error);
          setSearch({ term, companies: [], error });
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, reloadKey]);

  const isSearching = term !== '' && search.term !== term;
  const searchError = !isSearching ? search.error : null;
  const retry = () => {
    setAllError(null);
    setSearch((prev) => ({ ...prev, term: '' }));
    setReloadKey((key) => key + 1);
  };

  // ถ้าคำค้นตรงกับต้นชื่อจังหวัด (เช่น "ปทุม") ให้แสดงเฉพาะบริษัทในจังหวัดนั้น
  // หรือที่ชื่อ/ตำแหน่งตรง ตัดผลที่เจอแค่ในที่อยู่ออก (เช่น "เขตปทุมวัน" ของกรุงเทพฯ)
  const keyword = term.toLowerCase();
  const provinces = [...new Set((allCompanies ?? []).map((c) => c.province).filter(Boolean))];
  const isProvinceSearch = keyword !== '' && provinces.some((p) => p.startsWith(keyword));
  const companies = search.companies;
  const searchResults = isProvinceSearch
    ? companies.filter(
        (c) =>
          c.province?.startsWith(keyword) ||
          c.name?.toLowerCase().includes(keyword) ||
          (c.positions ?? []).some((p) => p.name?.toLowerCase().includes(keyword))
      )
    : companies;

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
              placeholder="ค้นหาชื่อสถานประกอบการ จังหวัด หรือตำแหน่งงาน"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && term && !isSearching && searchResults.length > 0) {
                  navigate(`/company/${searchResults[0].id}`);
                }
              }}
              className="home-search-input"
            />

            {/* ผลการค้นหา: กดชื่อเพื่อไปดูรายละเอียดที่หน้าสถานประกอบการ */}
            {term && (
              <ul className="home-search-results" aria-live="polite" aria-busy={isSearching}>
                {isSearching ? (
                  <li className="home-search-result-status">
                    <span className="home-spinner" aria-hidden="true" />
                    กำลังค้นหา…
                  </li>
                ) : searchError ? (
                  <li className="home-search-result-status home-search-result-status--error">
                    ค้นหาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
                    <button type="button" className="home-retry-btn" onClick={retry}>
                      ลองใหม่
                    </button>
                  </li>
                ) : searchResults.length > 0 ? (
                  searchResults.map((company) => {
                    // ตำแหน่งที่ตรงกับคำค้น แสดงใต้ชื่อให้รู้ว่าเจอเพราะอะไร
                    const matchedPositions = (company.positions ?? [])
                      .map((p) => p.name)
                      .filter((name) => name?.toLowerCase().includes(keyword));

                    return (
                      <li key={company.id}>
                        <button
                          type="button"
                          className="home-search-result-item"
                          onClick={() => navigate(`/company/${company.id}`)}
                        >
                          <span className="home-search-result-text">
                            <span className="home-search-result-name">{company.name}</span>
                            {matchedPositions.length > 0 && (
                              <span className="home-search-result-positions">
                                {matchedPositions.join(', ')}
                              </span>
                            )}
                          </span>
                          {company.province && (
                            <span className="home-search-result-province">{company.province}</span>
                          )}
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <li className="home-search-result-status">
                    ไม่พบสถานประกอบการที่ตรงกับ “{term}”
                  </li>
                )}
              </ul>
            )}
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

        {/* เกณฑ์รับสมัครเข้าแผนสหกิจศึกษา Section */}
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

          {/* คุณสมบัติพื้นฐาน */}
          <div className="criteria-box base-qualification-box">
            <img src={PiechartIcon} alt="PiechartIcon" className="criteria-icon" />
            <div className="base-qual-content">
              <p className="base-qual-title">คุณสมบัติพื้นฐาน</p>
              <p className="base-qual-desc">
                GPAX สะสม : ไม่ต่ำกว่า <strong>2.75</strong> (คำนวณเมื่อสิ้นภาคการศึกษาฤดูร้อน)
                <br></br> พฤติกรรม : มีความประพฤติดี ไม่เคยถูกลงโทษทางวินัยนักศึกษา
              </p>
            </div>
          </div>

          {/* หลักสูตร Grid */}
          <div className="curriculum-grid">
            {/* หลักสูตร 61 */}
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

            {/* หลักสูตร 66 */}
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

          {/* เงื่อนไขและข้อกำหนดสำคัญ */}
          <div className="important-conditions-box">
            <h3 className="conditions-title">เงื่อนไขและข้อกำหนดสำคัญ</h3>
            <p className="conditions-desc">
              นักศึกษาต้องเตรียมความพร้อมและปฏิบัติตามระเบียบการฝึกอบรมสหกิจศึกษานั้น และจะไม่สามารถขอสถาบันหรือสถานประกอบการได้ หากคุณสมบัติไม่ครบถ้วน การคัดเลือกนักศึกษาเข้าทำงานขึ้นอยู่กับคณะกรรมการบริหารวิชาของสาขาวิชา จำนวนของนักศึกษาที่ให้สิทธิ์อาจปรับเปลี่ยนได้ตามจำนวนผู้ผ่านงานรายงานผล และการจัดฝึกอบรมผลงานการฝึกเป็นสำคัญ
            </p>
          </div>
        </section>

        {/* MOU สถานประกอบการ Section */}
        <section className="mou-section">
          {/* Header */}
          <div className="mou-header">
            <h3 className="mou-title">สถานประกอบการ</h3>
          </div>

          {/* Logos Grid */}
          {allError ? (
            <div className="home-state-box home-state-box--error">
              <p>ไม่สามารถโหลดข้อมูลสถานประกอบการได้</p>
              <button type="button" className="home-retry-btn" onClick={retry}>
                ลองใหม่
              </button>
            </div>
          ) : allCompanies && allCompanies.length === 0 ? (
            <div className="home-state-box">
              <p>ยังไม่มีข้อมูลสถานประกอบการ</p>
            </div>
          ) : (
            <div className="company-logo-grid" aria-busy={!allCompanies}>
              {!allCompanies && Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="company-logo-card company-logo-skeleton" aria-hidden="true" />
              ))}
              {(allCompanies ?? []).slice(0, 8).map((company) => (
                <div
                  key={company.id}
                  className="company-logo-card"
                  title={company.name}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/company/${company.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/company/${company.id}`);
                  }}
                >
                  {company.logo ? (
                    <img
                      src={getImageUrl(company.logo)}
                      alt={company.name}
                      className="company-logo-img"
                    />
                  ) : (
                    <div className="company-logo-placeholder">
                      <span className="placeholder-empty">ไม่พบรูปภาพ</span>
                      <span className="placeholder-name">{company.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

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