import { useState } from 'react';
import '../pages/CSS/myApplications.css';
import '../pages/CSS/pendingApplications.css';

const DECISION = {
  approved: { label: 'อนุมัติ', button: 'app-btn--primary' },
  rejected: { label: 'ไม่อนุมัติ', button: 'app-btn--ghost' },
};

// ปุ่มอนุมัติ / ไม่อนุมัติ พร้อมช่องความเห็น — ใช้ร่วมกันระหว่างอาจารย์ที่ปรึกษาและเจ้าหน้าที่
// onSubmit(decision, comment) เรียกเมื่อกดยืนยัน (decision = 'approved' | 'rejected')
export default function ReviewPanel({ id, onSubmit, onOpen }) {
  // null = ยังไม่เปิดช่องความเห็น / { decision, comment, error }
  const [draft, setDraft] = useState(null);

  const open = (decision) => {
    setDraft({ decision, comment: '', error: '' });
    onOpen?.();
  };

  const submit = () => {
    const comment = draft.comment.trim();
    // ไม่อนุมัติต้องบอกเหตุผล นักศึกษาจะได้รู้ว่าต้องแก้อะไร
    if (draft.decision === 'rejected' && !comment) {
      setDraft({ ...draft, error: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ' });
      return;
    }
    onSubmit(draft.decision, comment);
    setDraft(null);
  };

  if (!draft) {
    return (
      <div className="app-actions pending-actions">
        <button type="button" className="app-btn app-btn--ghost" onClick={() => open('rejected')}>
          ไม่อนุมัติ
        </button>
        <button type="button" className="app-btn app-btn--primary" onClick={() => open('approved')}>
          อนุมัติ
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
        placeholder={draft.decision === 'rejected' ? 'เช่น GPAX ยังไม่ถึงเกณฑ์ที่บริษัทกำหนด' : 'ความเห็นถึงนักศึกษา'}
        autoFocus
      />
      {draft.error && <p className="pending-error">{draft.error}</p>}
      <div className="app-actions pending-actions">
        <button type="button" className="app-btn pending-btn-cancel" onClick={() => setDraft(null)}>
          ยกเลิก
        </button>
        <button type="button" className={`app-btn ${DECISION[draft.decision].button}`} onClick={submit}>
          ยืนยัน{DECISION[draft.decision].label}
        </button>
      </div>
    </div>
  );
}
