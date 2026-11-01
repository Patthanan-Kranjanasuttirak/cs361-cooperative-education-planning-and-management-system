import { COMMITTEE_RESULT, SCREENING_STATUS } from '../config/studentReview';
import './CSS/ApplicationStatusBadge.css';

const KINDS = { screening: SCREENING_STATUS, committee: COMMITTEE_RESULT };

// ป้ายผลคัดกรองของเจ้าหน้าที่ (kind="screening") หรือผลคัดเลือกของกรรมการ (kind="committee")
export default function SelectionBadge({ kind, value }) {
  const info = KINDS[kind][value ?? 'none'];
  return <span className={`status-badge status-badge--${info.tone}`}>{info.label}</span>;
}
