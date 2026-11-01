import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import ApiState from '../../components/ApiState';
import { formatPhone } from '../../utils/phone';
import '../CSS/myApplications.css';
import '../CSS/manageCompanies.css';
import '../CSS/allApplications.css';
import '../CSS/selection.css';

const formatDate = (iso) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

// รายชื่อนักศึกษาที่ยืนยันสิทธิ์แล้ว พร้อมสถานประกอบการ ตำแหน่ง และผู้รับ: ดาวน์โหลด CSV หรือพิมพ์/บันทึกเป็น PDF
export default function ConfirmedReport() {
  const { data: terms } = useApi('/terms');
  const [termId, setTermId] = useState('');
  const { data: rows, loading, error } = useApi(`/reports/confirmed${termId ? `?term_id=${termId}` : ''}`);
  const [notice, setNotice] = useState('');
  const termCode = terms.find((t) => String(t.term_id) === termId)?.code;
  const download = async () => {
    setNotice('');
    try {
      const url = URL.createObjectURL(await api(`/reports/confirmed?format=csv${termId ? `&term_id=${termId}` : ''}`, { blob: true }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `coop-confirmed${termCode ? `-${termCode.replace('/', '-')}` : ''}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setNotice(err.message); }
  };
  return (
    <section className="report">
      <div className="app-header">
        <h1 className="app-title">รายชื่อนักศึกษาที่ยืนยันสิทธิ์แล้ว</h1>
        <div className="selection-actions report-actions">
          <button type="button" className="app-btn selection-secondary" onClick={download} disabled={!rows.length}>ดาวน์โหลด CSV</button>
          <button type="button" className="app-btn app-btn--primary" onClick={() => window.print()} disabled={!rows.length}>พิมพ์ / บันทึก PDF</button>
        </div>
      </div>
      <p className="report-meta">
        {termCode ? `ภาคการศึกษา ${termCode} · ` : ''}ทั้งหมด {rows.length} คน · ข้อมูล ณ วันที่ {formatDate(new Date())}
      </p>

      <label className="all-filter report-actions report-filter">
        <span className="pending-label">ภาคการศึกษา</span>
        <select className="profile-input all-select" value={termId} onChange={(e) => setTermId(e.target.value)}>
          <option value="">ทุกภาคการศึกษา</option>
          {terms.map((t) => <option key={t.term_id} value={t.term_id}>{t.code}</option>)}
        </select>
      </label>

      <ApiState loading={loading} error={error} />
      {notice && <div className="app-banner" role="status">{notice}</div>}

      {!loading && rows.length === 0 ? (
        <div className="app-empty"><p>ยังไม่มีนักศึกษาที่ยืนยันสิทธิ์</p></div>
      ) : (
        <div className="cm-table-wrap">
          <table className="cm-table report-table">
            <thead>
              <tr>
                <th>ลำดับ</th><th>รหัสนักศึกษา</th><th>ชื่อ-นามสกุล</th><th>สถานประกอบการ</th><th>ตำแหน่ง</th><th>ผู้รับ (บริษัท)</th><th>วันที่ยืนยันสิทธิ์</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.term}-${row.student_code}`}>
                  <td data-label="ลำดับ">{index + 1}</td>
                  <td data-label="รหัสนักศึกษา">{row.student_code}</td>
                  <td data-label="ชื่อ-นามสกุล">{row.th_name}<p className="cm-muted">{[row.email, formatPhone(row.phone)].filter(Boolean).join(' · ')}</p></td>
                  <td data-label="สถานประกอบการ">{row.company_name}</td>
                  <td data-label="ตำแหน่ง">{row.position_name}</td>
                  <td data-label="ผู้รับ (บริษัท)">
                    {row.receiver_name ?? '-'}
                    <p className="cm-muted">{[row.receiver_email, formatPhone(row.receiver_phone)].filter(Boolean).join(' · ')}</p>
                  </td>
                  <td data-label="วันที่ยืนยันสิทธิ์">{row.confirmed_at ? formatDate(row.confirmed_at) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
