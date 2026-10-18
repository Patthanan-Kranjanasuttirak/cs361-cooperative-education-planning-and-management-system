import { NavLink, Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/useAuth';
import { ROLES } from '../config/roles';
import './CSS/RoleLayout.css';

// โครงหน้าหลัง login ใช้ร่วมกันทุกบทบาท เมนูข้างดึงจาก config/roles.js
export default function RoleLayout() {
  const { user } = useAuth();
  const role = ROLES[user.role];

  return (
    <div className="role-page-container">
      <Navbar />
      <div className="role-content-wrapper">
        <aside className="role-sidebar">
          <div className="role-sidebar-header">
            <p className="role-sidebar-name">{user.th_name}</p>
            <p className="role-sidebar-role">{role.label}</p>
          </div>
          <nav className="role-sidebar-menu">
            {role.menu.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `role-menu-item${isActive ? ' role-menu-item--active' : ''}`}
              >
                {item.name}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="role-main">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}
