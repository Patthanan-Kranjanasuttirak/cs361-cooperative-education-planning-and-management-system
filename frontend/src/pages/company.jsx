import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/image';
import companiesData from '../data/mockfile.json';
import locationIcon from '../assets/location.png';
import searchIcon from '../assets/search.png';
import CompanyDetailModal from '../components/CompanyDetailModal';

export default function company() {
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
    <div className="min-h-screen bg-gray-50 py-10 px-4 flex flex-col items-center">
      {/* Header Container */}
      <header className="w-full max-w-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <button
            onClick={() => navigate('/')}
            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1.5 cursor-pointer mb-2"
          >
            ← กลับหน้าหลัก
          </button>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">
            รายชื่อสถานประกอบการ
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">รายชื่อและรายละเอียดข้อมูลสถานประกอบการสำหรับสหกิจศึกษา</p>
        </div>

        {/* Search Bar for Company Page */}
        <div className="bg-white p-2.5 px-4 rounded-xl shadow-xs border border-gray-200 flex items-center w-full sm:max-w-xs">
          <span className="text-gray-400 text-sm mr-2">🔍</span>
          <input
            type="text"
            placeholder="ค้นหาในหน้านี้..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-gray-700 text-xs"
          />
        </div>
      </header>

      {/* List Container */}
      <div className="w-full max-w-3xl space-y-4">
        {filteredCompanies.length > 0 ? (
          filteredCompanies.map((company) => (
            <div
              key={company.id}
              onClick={() => setSelectedCompany(company)}
              className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center gap-5 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer"
            >
              {/* Logo Box */}
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 flex-shrink-0">
                {company.logo ? (
                  <img src={getImageUrl(company.logo)} alt={company.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-2xl">🏢</span>
                )}
              </div>

              {/* Details Column */}
              <div className="flex-1 space-y-2.5">
                <div>
                  <h2 className="text-base font-bold text-gray-800">{company.name}</h2>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{company.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                </div>

                {/* Meta details */}
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1.5 border-t border-gray-50 text-xs font-semibold text-gray-500">
                  <span className="flex items-center gap-1"> <img src={locationIcon} alt="pin" className="w-4 h-4 object-contain" /> {company.location || 'ไม่ระบุ'}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-xs">
            <span className="text-4xl"><img src={searchIcon} alt="search" className="w-4 h-4 object-contain" /></span>
            <p className="text-sm text-gray-400 mt-3 font-semibold">ไม่พบข้อมูลที่ค้นหา</p>
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
  );
}
