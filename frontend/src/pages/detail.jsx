import { useParams, useNavigate } from 'react-router-dom';
import companiesData from '../data/mockfile.json';

export default function detail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const company = companiesData.find((c) => c.id === parseInt(id));

  if (!company) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <p className="text-gray-600 mb-4">ไม่พบข้อมูลสถานประกอบการ</p>
        <button 
          onClick={() => navigate('/')} 
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
        >
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-200 relative animate-fadeIn">
        
        {/* ปุ่มย้อนกลับ */}
        <button 
          onClick={() => navigate('/')}
          className="mb-4 text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
        >
          ← กลับหน้าหลัก
        </button>

        {/* แบนเนอร์จำลอง */}
        <div className="w-full h-36 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl mb-6 flex items-center justify-center text-white font-semibold text-lg shadow-inner">
          {company.name}
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-1">{company.name}</h1>
        <p className="text-xs text-gray-400 mb-6 uppercase tracking-wider">รายละเอียดสถานประกอบการ MOU</p>
        
        <div className="space-y-3 text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
          <p className="flex justify-between border-b pb-2">
            <strong className="text-gray-500">รายละเอียด :</strong> 
            <span className="text-right text-gray-800">{company.description}</span>
          </p>
          <p className="flex justify-between border-b pb-2">
            <strong className="text-gray-500">สถานที่ฝึกงาน :</strong> 
            <span className="text-right text-gray-800">{company.location}</span>
          </p>
          <p className="flex justify-between border-b pb-2">
            <strong className="text-gray-500">ค่าตอบแทน :</strong> 
            <span className="text-right text-green-600 font-semibold">{company.stipend}</span>
          </p>
          <p className="flex justify-between">
            <strong className="text-gray-500">ตำแหน่งที่เปิดรับ :</strong> 
            <span className="text-right text-gray-800">{company.positions}</span>
          </p>
        </div>

        <div className="flex justify-end">
          <button 
            onClick={() => navigate('/')}
            className="bg-gray-800 text-white px-5 py-2.5 rounded-xl hover:bg-gray-700 text-sm font-medium transition shadow-sm"
          >
            ปิด / ย้อนกลับ
          </button>
        </div>

      </div>
    </div>
  );
}