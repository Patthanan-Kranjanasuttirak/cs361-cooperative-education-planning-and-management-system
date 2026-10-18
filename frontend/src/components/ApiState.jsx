export default function ApiState({ loading, error }) {
  if (error) return <p className="profile-error" role="alert">{error}</p>;
  return loading ? <p role="status">กำลังโหลดข้อมูล…</p> : null;
}
