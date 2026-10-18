import '../pages/CSS/pendingApplications.css';
import './CSS/DocumentLink.css';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../services/api';

function PdfPreview({ blob, filename, label, onClose }) {
  const dialog = useRef(null);
  const frame = useRef(null);
  const openLink = useRef(null);
  const downloadLink = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    frame.current.src = url;
    openLink.current.href = url;
    downloadLink.current.href = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  useEffect(() => { dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className="pdf-preview" aria-labelledby={titleId} onClose={onClose}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="pdf-preview-content">
      <header className="pdf-preview-header">
        <h2 id={titleId}>{label}</h2>
        <div className="pdf-preview-actions">
          <a ref={openLink} target="_blank" rel="noopener noreferrer">เปิดแท็บใหม่</a>
          <a ref={downloadLink} download={filename}>ดาวน์โหลด</a>
          <button type="button" onClick={onClose} aria-label="ปิดเอกสาร" autoFocus>✕</button>
        </div>
      </header>
      <iframe ref={frame} className="pdf-preview-frame" title={label} />
      <p className="pdf-preview-hint">หากเบราว์เซอร์ไม่แสดง PDF ให้เลือกเปิดแท็บใหม่หรือดาวน์โหลดไฟล์</p>
    </div>
  </dialog>;
}

// Protected local documents are fetched with the current token before previewing.
export default function DocumentLink({ url, label }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const open = async () => {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const blob = await api(url, { blob: true });
      if (blob.type.split(';')[0] !== 'application/pdf' || blob.size === 0) throw new Error('ไฟล์เอกสารไม่ใช่ PDF ที่เปิดดูได้ กรุณาอัปโหลดใหม่');
      const filename = decodeURIComponent(url.split('/').pop()).split('/').pop();
      setPreview({ blob, filename });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  if (!url) {
    return (
      <span className="pending-doc pending-doc--missing" title="ยังไม่มีเอกสาร">
        {label} (ยังไม่มีไฟล์)
      </span>
    );
  }
  return (
    <span>
      {url.startsWith('/documents/')
        ? <button type="button" className="pending-doc document-open" onClick={open} disabled={loading}>{loading ? 'กำลังเปิดเอกสาร…' : label}</button>
        : <a className="pending-doc" href={url} target="_blank" rel="noopener noreferrer">{label}</a>}
      {error && <span className="profile-error" role="alert">{error}</span>}
      {preview && <PdfPreview {...preview} label={label} onClose={() => setPreview(null)} />}
    </span>
  );
}
