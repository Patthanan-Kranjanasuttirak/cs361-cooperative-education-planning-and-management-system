import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { ROLES } from '../config/roles';

// ซ่อนหน้าตามบทบาทเพื่อการใช้งานเท่านั้น ความปลอดภัยจริงอยู่ที่ backend (เช็ก token ทุก request)
export default function ProtectedRoute({ roles }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLES[user.role].home} replace />;
  }
  return <Outlet />;
}
