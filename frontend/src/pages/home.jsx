import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getImageUrl } from '../utils/image';
import companiesData from '../data/mockfile.json';
import CompanyDetailModal from '../components/CompanyDetailModal';

export default function home() {
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      {/* Header ระบบ */}
      <header className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">
          ระบบจัดการแผนสหกิจศึกษา
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Cooperative Education Planning & Management System
        </p>
      </header>

      {/* Search Bar */}
      <div className="w-full max-w-2xl bg-white p-3 rounded-xl shadow-sm border border-gray-200 mb-8 flex items-center">
        <span className="text-gray-400 px-3">🔍</span>
        <input
          type="text"
          placeholder="ค้นหาสถานประกอบการ หรือชื่อบริษัท..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent outline-none text-gray-700 text-sm"
        />
      </div>

      {/* เกณฑ์การประเมิน Section */}
      <section className="w-full max-w-4xl bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-gray-100 pb-3 mb-4 gap-2">
          <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
            📋 เกณฑ์การประเมินสหกิจศึกษา
          </h2>
          <span className="text-xs text-blue-600 hover:underline cursor-pointer font-medium">รายละเอียดเพิ่มเติม</span>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
          <li className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 flex items-start gap-2.5">
            <span className="text-green-500 font-bold">✓</span>
            <span>ผ่านการอบรมเตรียมความพร้อมสหกิจศึกษา</span>
          </li>
          <li className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 flex items-start gap-2.5">
            <span className="text-green-500 font-bold">✓</span>
            <span>หน่วยกิตสะสมไม่น้อยกว่า 90 หน่วยกิต</span>
          </li>
          <li className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 flex items-start gap-2.5">
            <span className="text-green-500 font-bold">✓</span>
            <span>เกรดเฉลี่ยสะสม (GPAX) ผ่านตามเกณฑ์คณะ</span>
          </li>
        </ul>
      </section>

      {/* MOU สถานประกอบการ Section */}
      <section className="w-full max-w-4xl bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">MOU</h2>
          <h3 className="text-lg font-bold text-gray-800 mt-0.5">สถานประกอบการ</h3>
        </div>

        {/* Logos Flex Container */}
        <div className="flex flex-wrap justify-center gap-4 w-full">
          {filteredCompanies.slice(0, 6).map((company) => (
            <div
              key={company.id}
              className="bg-gray-100 border border-transparent w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shadow-2xs flex items-center justify-center p-3"
              title={company.name}
            >
              {company.logo ? (
                <img
                  src={getImageUrl(company.logo)}
                  alt={company.name}
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl">🏢</span>
                  <span className="text-[10px] font-semibold text-gray-500 line-clamp-1">{company.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Subtitle Link */}
        <button
          onClick={() => navigate('/company')}
          className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-semibold mt-6 cursor-pointer active:scale-95 transition-all duration-150"
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