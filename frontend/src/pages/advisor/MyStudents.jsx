import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ApplicationStatusBadge from '../../components/ApplicationStatusBadge';
import GpaxValue from '../../components/GpaxValue';
import CoopResultBadge from '../../components/CoopResultBadge';
import { useApi } from '../../hooks/useApi';
import ApiState from '../../components/ApiState';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/myStudents.css';

// ตัวกรองด้านบน: ชื่อ + เงื่อนไขของแต่ละกลุ่ม
const FILTERS = [
  { key: 'all', label: 'ทั้งหมด', match: () => true },
  { key: 'pending', label: 'มีใบรออนุมัติ', match: (s) => s.pending_count > 0 },
  { key: 'none', label: 'ยังไม่สมัคร', match: (s) => s.application_count === 0 },
  { key: 'confirmed', label: 'ยืนยันสิทธิ์แล้ว', match: (s) => s.latest?.status === 'confirmed' },
];

const formatDate = (iso) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

export default function MyStudents() {
  const { data: students, loading, error } = useApi('/advisor/students');
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const keyword = search.trim().toLowerCase();
  const activeFilter = FILTERS.find((f) => f.key === filter);
  const visible = students.filter(
    (s) =>
      activeFilter.match(s) &&
      (!keyword || s.th_name.toLowerCase().includes(keyword) || s.student_code.includes(keyword))
  );

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">นักศึกษาในความดูแล</h1>
        <span className="app-term">{students.length} คน</span>
      </div>

      <ApiState loading={loading} error={error} />
      <div className="students-filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`students-filter${filter === f.key ? ' students-filter--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="students-filter-count">{students.filter(f.match).length}</span>
          </button>
        ))}
      </div>

      <input
        className="pending-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหาชื่อ / รหัสนักศึกษา"
      />

      {visible.length === 0 ? (
        <div className="app-empty">
          <p>ไม่พบนักศึกษา</p>
        </div>
      ) : (
        <div className="students-table-wrap">
          <table className="students-table">
            <thead>
              <tr>
                <th>นักศึกษา</th>
                <th className="students-num">GPAX</th>
                <th>สถานะสหกิจศึกษา</th>
                <th className="students-num">ใบสมัคร</th>
                <th>สถานะล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                // ทั้งแถวกดได้ (ชื่อเป็นลิงก์จริงสำหรับคีย์บอร์ด/เปิดแท็บใหม่)
                <tr key={s.student_id} className="students-row" onClick={() => navigate(`/advisor/students/${s.student_id}`)}>
                  <td data-label="นักศึกษา">
                    <Link to={`/advisor/students/${s.student_id}`} className="students-name students-name-link" onClick={(e) => e.stopPropagation()}>
                      {s.th_name}
                    </Link>
                    <p className="students-code">{s.student_code}</p>
                  </td>
                  <td data-label="GPAX" className="students-num">
                    <GpaxValue gpax={s.gpax} />
                  </td>
                  <td data-label="สถานะสหกิจศึกษา">
                    <CoopResultBadge student={s} />
                  </td>
                  <td data-label="ใบสมัคร" className="students-num">
                    {s.application_count}
                    {/* ใบรออนุมัติอยู่ที่อาจารย์นิเทศก์ของนักศึกษา (อาจเป็นอาจารย์คนอื่น) */}
                    {s.pending_count > 0 && <p className="students-code">รออนุมัติ {s.pending_count}</p>}
                  </td>
                  <td data-label="สถานะล่าสุด">
                    {s.latest ? (
                      <>
                        <ApplicationStatusBadge status={s.latest.status} />
                        <p className="students-latest">{s.latest.company_name}</p>
                        <p className="students-code">
                          {s.latest.position_name} · {formatDate(s.latest.changed_at)}
                        </p>
                      </>
                    ) : (
                      <span className="students-code">ยังไม่มีใบสมัคร</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
