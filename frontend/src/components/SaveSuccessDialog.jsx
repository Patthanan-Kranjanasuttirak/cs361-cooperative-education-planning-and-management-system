import { useEffect, useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../pages/CSS/studentProfile.css';

export default function SaveSuccessDialog({ title = 'บันทึกข้อมูลเรียบร้อยแล้ว', to, nextPageLabel }) {
  const dialog = useRef(null);
  const id = useId();
  const navigate = useNavigate();
  useEffect(() => {
    dialog.current.showModal();
    const timer = window.setTimeout(() => navigate(to), 2000);
    return () => window.clearTimeout(timer);
  }, [navigate, to]);
  const next = () => navigate(to);
  return <dialog ref={dialog} className="profile-validation-dialog profile-success-dialog" role="alertdialog"
    aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onClose={next}
    onCancel={(event) => { event.preventDefault(); next(); }}>
    <span className="profile-success-icon" aria-hidden="true">✓</span>
    <h2 id={`${id}-title`}>{title}</h2>
    <p id={`${id}-description`}>กำลังไปหน้า{nextPageLabel}โดยอัตโนมัติ…</p>
    <div className="profile-validation-actions"><button type="button" className="profile-submit" onClick={next} autoFocus>ถัดไป</button></div>
  </dialog>;
}
