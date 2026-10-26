import { CONDUCT_STATUS, PROFILE_STATUS } from '../config/studentReview';
import './CSS/ApplicationStatusBadge.css';

// ป้ายผลตรวจข้อมูลส่วนตัว (kind="profile") หรือการรับรองความประพฤติ (kind="conduct")
export default function StudentReviewBadge({ kind, status }) {
  const info = (kind === 'profile' ? PROFILE_STATUS : CONDUCT_STATUS)[status ?? 'none'];
  return <span className={`status-badge status-badge--${info.tone}`}>{info.label}</span>;
}
