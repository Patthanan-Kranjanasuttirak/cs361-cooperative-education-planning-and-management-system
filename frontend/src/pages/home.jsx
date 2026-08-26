import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import companiesData from '../data/mockfile.json';

export default function home() {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

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

      {/* MOU สถานประกอบการ Section */}
      <section className="w-full max-w-4xl bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
        <h2 className="text-center font-bold text-gray-700 mb-6 text-lg">
          MOU สถานประกอบการ
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {filteredCompanies.map((company) => (
            <div 
              key={company.id}
              onClick={() => navigate(`/detail/${company.id}`)}
              className="bg-gray-100 h-28 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 border border-transparent transition-all duration-200 p-3 shadow-2xs text-center group"
            >
              <div className="w-8 h-8 rounded-full bg-gray-300 group-hover:bg-blue-200 flex items-center justify-center mb-2 text-xs font-bold text-gray-600 group-hover:text-blue-700">
                🏢
              </div>
              <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700 line-clamp-2">
                {company.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ส่วนเนื้อหาล่างและเกณฑ์ */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-64 flex flex-col justify-center items-center text-gray-400 text-sm">
          📅 ข้อมูล / ปฏิทินสหกิจศึกษา
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-64 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-gray-800 mb-3 text-base border-b pb-2">
              เกณฑ์การประเมิน
            </h3>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              <li>ผ่านการอบรมเตรียมความพร้อมสหกิจศึกษา</li>
              <li>หน่วยกิตสะสมไม่น้อยกว่า 90 หน่วยกิต</li>
              <li>เกรดเฉลี่ยสะสม (GPAX) ผ่านตามเกณฑ์คณะ</li>
            </ul>
          </div>
          <span className="text-xs text-gray-400 text-right">รายละเอียดเพิ่มเติม</span>
        </div>
      </div>
    </div>
  );
}