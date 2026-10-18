import './CSS/FileInput.css';

// ช่องเลือกไฟล์ที่กำหนดข้อความเองได้ (ข้อความของ <input type="file"> ปกติเปลี่ยนไม่ได้)
// ทั้งกล่องเป็น <label> กดตรงไหนก็เปิดหน้าต่างเลือกไฟล์
export default function FileInput({ id, accept, onChange, disabled, error, fileName }) {
  const className = ['file-input', error && 'file-input--error', disabled && 'file-input--disabled'].filter(Boolean).join(' ');
  return (
    <label className={className}>
      <input id={id} type="file" accept={accept} onChange={onChange} disabled={disabled} className="file-input-native" />
      <span className="file-input-button">เลือกไฟล์</span>
      <span className={`file-input-name${fileName ? ' file-input-name--chosen' : ''}`}>{fileName || 'ไม่ได้เลือกไฟล์'}</span>
    </label>
  );
}
