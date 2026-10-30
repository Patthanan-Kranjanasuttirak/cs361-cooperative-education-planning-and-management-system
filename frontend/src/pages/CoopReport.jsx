import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import ApiState from '../components/ApiState';
import { curriculumLabel } from '../config/coopCriteria';
import { formatPhone } from '../utils/phone';
import './CSS/myApplications.css';
import './CSS/manageCompanies.css';
import './CSS/selection.css';

const formatDate = (iso) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

// รายชื่อนักศึกษาที่ประกาศว่าผ่านเข้าแผนสหกิจศึกษา: ดาวน์โหลด CSV หรือพิมพ์/บันทึกเป็น PDF (เจ้าหน้าที่และกรรมการ)
export default function CoopReport() {
  const { data: rows, loading, error } = useApi('/reports/coop-passed');
  const [notice, setNotice] = useState('');
  const download = async () => {
    setNotice('');
    try {
      const url = URL.createObjectURL(await api('/reports/coop-passed?format=csv', { blob: true }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'coop-passed.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setNotice(err.message); }
  };
  return (
    <section className="report">
      <div className="app-header">
        <h1 className="app-title">รายชื่อนักศึกษาที่ผ่านเข้าแผนสหกิจศึกษา</h1>
        <div className="selection-actions report-actions">
          <button type="button" className="app-btn selection-secondary" onClick={download} disabled={!rows.length}>ดาวน์โหลด CSV</button>
          <button type="button" className="app-btn app-btn--primary" onClick={() => window.print()} disabled={!rows.length}>พิมพ์ / บันทึก PDF</button>
        </div>
      </div>
      <p className="report-meta">ทั้งหมด {rows.length} คน · ข้อมูล ณ วันที่ {formatDate(new Date())}</p>

      <ApiState loading={loading} error={error} />
      {notice && <div className="app-banner" role="status">{notice}</div>}

      {!loading && rows.length === 0 ? (
        <div className="app-empty"><p>ยังไม่มีนักศึกษาที่ประกาศผลว่าผ่าน</p></div>
      ) : (
        <div className="cm-table-wrap">
          <table className="cm-table report-table">
            <thead>
              <tr>
                <th>ลำดับ</th><th>รหัสนักศึกษา</th><th>ชื่อ-นามสกุล</th><th>กลุ่มวิชาเอก</th><th>หลักสูตร</th><th>GPAX</th><th>อีเมล</th><th>เบอร์โทรศัพท์</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.student_code}>
                  <td data-label="ลำดับ">{index + 1}</td>
                  <td data-label="รหัสนักศึกษา">{row.student_code}</td>
                  <td data-label="ชื่อ-นามสกุล">{row.th_name}<p className="cm-muted">{row.en_name}</p></td>
                  <td data-label="กลุ่มวิชาเอก">{row.major ?? '-'}</td>
                  <td data-label="หลักสูตร">{curriculumLabel(row.curriculum)}</td>
                  <td data-label="GPAX">{row.gpax?.toFixed(2) ?? '-'}</td>
                  <td data-label="อีเมล">{row.email}</td>
                  <td data-label="เบอร์โทรศัพท์">{formatPhone(row.phone) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
