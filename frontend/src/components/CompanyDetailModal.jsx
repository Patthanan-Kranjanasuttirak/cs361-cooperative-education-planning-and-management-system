import { useEffect } from 'react';
import locationIcon from '../assets/location.png';

export default function CompanyDetailModal({ company, onClose }) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';

    // Escape key press handler
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!company) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-xs transition-opacity duration-300 animate-backdrop-fade-in cursor-pointer"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 transform transition-all duration-300 animate-modal-scale-up flex flex-col max-h-[90vh]">

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-700 hover:text-gray-900 shadow-md flex items-center justify-center border border-gray-200/50 transition-all duration-200 cursor-pointer"
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="w-full h-36 bg-gradient-to-r from-blue-600 to-indigo-600 flex flex-col justify-end p-6 text-white relative">
          <h2 className="text-xl font-bold line-clamp-1">{company.name}</h2>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">

          <div className="space-y-1.5">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">รายละเอียด</h3>
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50/70 p-4 rounded-xl border border-gray-100">
              {company.description || 'ไม่มีข้อมูลรายละเอียดเพิ่มเติมสำหรับสถานประกอบการนี้'}
            </p>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3.5">

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm gap-1">
              <span className="text-gray-400 font-medium flex items-center gap-1.5">
                <img src={locationIcon} alt="province" className="w-4 h-4 object-contain" />
                จังหวัดที่ปฏิบัติงาน
              </span>
              <span className="text-gray-800 font-semibold sm:text-right">{company.province || 'ไม่ระบุ'}</span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm gap-1">
              <span className="text-gray-400 font-medium flex items-center gap-1.5">
                <img src={locationIcon} alt="location" className="w-4 h-4 object-contain" />
                รายละเอียดสถานที่ปฏิบัติงาน
              </span>
              <span className="text-gray-800 font-semibold sm:text-right">{company.location || 'ไม่ระบุ'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50/50 px-6 py-4 flex justify-end border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer shadow-sm hover:shadow active:scale-98"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
}
