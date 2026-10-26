import { useState } from 'react';
import '../pages/CSS/myApplications.css';
import '../pages/CSS/pendingApplications.css';

const BUTTON = { approved: 'app-btn--primary', rejected: 'app-btn--ghost' };
const DEFAULT_LABELS = { approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ' };

// ปุ่มอนุมัติ / ไม่อนุมัติ พร้อมช่องความเห็น — ใช้ร่วมกันทั้งใบสมัคร การตรวจข้อมูล และการรับรองความประพฤติ
// onSubmit(decision, comment) เรียกเมื่อกดยืนยัน (decision = 'approved' | 'rejected')
// labels เปลี่ยนข้อความปุ่ม เช่น { approved: 'ข้อมูลถูกต้อง', rejected: 'ส่งกลับให้แก้ไข' }
export default function ReviewPanel({ id, onSubmit, onOpen, labels = DEFAULT_LABELS, rejectPlaceholder = 'เช่น GPAX ยังไม่ถึงเกณฑ์ที่บริษัทกำหนด' }) {
  // null = ยังไม่เปิดช่องความเห็น / { decision, comment, error }
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const open = (decision) => {
    setDraft({ decision, comment: '', error: '' });
    onOpen?.();
  };

  const submit = async () => {
    if (saving) return;
    const comment = draft.comment.trim();
    // ไม่อนุมัติต้องบอกเหตุผล นักศึกษาจะได้รู้ว่าต้องแก้อะไร
    if (draft.decision === 'rejected' && !comment) {
      setDraft({ ...draft, error: `กรุณาระบุเหตุผลที่${labels.rejected}` });
      return;
    }
    setSaving(true);
    try { if (await onSubmit(draft.decision, comment) !== false) setDraft(null); }
    catch (error) { setDraft((prev) => ({ ...prev, error: error.message })); }
    finally { setSaving(false); }
  };

  if (!draft) {
    return (
      <div className="app-actions pending-actions">
        <button type="button" className="app-btn app-btn--ghost" onClick={() => open('rejected')}>
          {labels.rejected}
        </button>
        <button type="button" className="app-btn app-btn--primary" onClick={() => open('approved')}>
          {labels.approved}
        </button>
      </div>
    );
  }

  return (
    <div className={`pending-review pending-review--${draft.decision}`}>
      <label className="pending-label" htmlFor={`comment-${id}`}>
        ความเห็น{draft.decision === 'rejected' ? ' (จำเป็น)' : ' (ไม่บังคับ)'}
      </label>
      <textarea
        id={`comment-${id}`}
        className={`pending-comment${draft.error ? ' pending-comment--error' : ''}`}
        rows={3}
        value={draft.comment}
        onChange={(e) => setDraft({ ...draft, comment: e.target.value, error: '' })}
        placeholder={draft.decision === 'rejected' ? rejectPlaceholder : 'ความเห็นถึงนักศึกษา'}
        autoFocus
      />
      {draft.error && <p className="pending-error">{draft.error}</p>}
      <div className="app-actions pending-actions">
        <button type="button" className="app-btn pending-btn-cancel" onClick={() => setDraft(null)}>
          ยกเลิก
        </button>
        <button type="button" className={`app-btn ${BUTTON[draft.decision]}`} onClick={submit} disabled={saving}>
          ยืนยัน{labels[draft.decision]}
        </button>
      </div>
    </div>
  );
}
