import { APPLICATION_STATUS } from '../config/applicationStatus';
import './CSS/ApplicationStatusBadge.css';

// ป้ายสถานะใบสมัคร (submitted, approved, accepted, ...)
export default function ApplicationStatusBadge({ status }) {
  const info = APPLICATION_STATUS[status] ?? { label: status, tone: 'muted' };
  return <span className={`status-badge status-badge--${info.tone}`}>{info.label}</span>;
}
