import { getPositionStats } from '../services/companyPortalMock';
import '../pages/CSS/myApplications.css';
import '../pages/CSS/pendingApplications.css';
import '../pages/CSS/companyPortal.css';
import './CSS/ApplicationStatusBadge.css';

// การ์ดตำแหน่งงาน: สถานะเปิด/ปิดรับ + ยืนยันสิทธิ์แล้ว / จำนวนที่เปิดรับ + จำนวนผู้สมัคร
// ใช้ทั้งหน้าผู้ประสานงาน (ส่งปุ่มจัดการมาเป็น children) และเจ้าหน้าที่ (ดูอย่างเดียว ไม่ส่ง children)
export default function PositionCard({ position: p, fullHint, children }) {
  const { applicants, confirmed } = getPositionStats(p.id);
  const full = p.quota != null && confirmed >= p.quota;
  const percent = p.quota ? Math.min(100, Math.round((confirmed / p.quota) * 100)) : 0;

  return (
    <li className={`app-card${p.is_open ? '' : ' cp-card--closed'}`}>
      <div className="app-card-head">
        <div>
          <p className="app-company">{p.name}</p>
          {p.description && <p className="app-position">{p.description}</p>}
        </div>
        <span className={`status-badge status-badge--${p.is_open ? 'success' : 'muted'}`}>{p.is_open ? 'เปิดรับสมัคร' : 'ปิดรับสมัคร'}</span>
      </div>

      <div className="cp-stats">
        <div className="cp-stat">
          <p className="pending-label">ยืนยันสิทธิ์แล้ว / จำนวนที่เปิดรับ</p>
          <p className="cp-stat-value">
            {confirmed} / {p.quota ?? 'ไม่ระบุ'}
          </p>
          {p.quota ? (
            <div className="cp-bar" aria-hidden="true">
              <div className={`cp-bar-fill${full ? ' cp-bar-fill--full' : ''}`} style={{ width: `${percent}%` }} />
            </div>
          ) : null}
        </div>
        <div className="cp-stat">
          <p className="pending-label">ผู้สมัครที่ผ่านการอนุมัติ</p>
          <p className="cp-stat-value">{applicants} คน</p>
        </div>
      </div>

      {full && p.is_open && fullHint && <p className="cp-full-hint">{fullHint}</p>}

      {children}
    </li>
  );
}
