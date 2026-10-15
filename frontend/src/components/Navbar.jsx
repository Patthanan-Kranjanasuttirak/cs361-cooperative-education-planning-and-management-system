import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { ROLES } from '../config/roles';
import logo from '../assets/CSTU-LOGO.png';
import './CSS/Navbar.css';

export default function Navbar() {
    const location = useLocation();
    const { user, logout } = useAuth();

    const handleContactClick = (e) => {
        e.preventDefault();
        const footerElement = document.getElementById('footer');
        if (footerElement) {
            footerElement.scrollIntoView({ behavior: 'smooth' });
        } else {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
    };

    const navLinks = [
        { name: 'หน้าแรก', href: '/' },
        { name: 'คู่มือนักศึกษา', href: '/student-handbook' },
        { name: 'สถานประกอบการ', href: '/company' },
        { name: 'ติดต่อ', href: '#footer', onClick: handleContactClick },
        user
            ? { name: 'หน้าของฉัน', href: ROLES[user.role].home }
            : { name: 'เข้าสู่ระบบ', href: '/login' },
    ];

    // อยู่หน้าสาธารณะก็อยู่หน้าเดิม อยู่หน้าที่ต้อง login ProtectedRoute จะพาไป /login เอง
    const handleLogout = () => {
        logout();
    };

    return (
        <nav className="navbar">
            {/* Top bar: Logo + Title */}
            <div className="navbar-top">
                <div className="navbar-top-inner">
                    <a href="/" className="navbar-logo">
                        <img src={logo} alt="CSTU Logo" className="navbar-logo-image" />
                    </a>
                    <div className="navbar-title-group">
                        <span className="navbar-title-th">ระบบจัดการแผนสหกิจศึกษา</span>
                        <span className="navbar-title-en">Cooperative Education Planning &amp; Management System</span>
                    </div>
                </div>
            </div>

            {/* Bottom bar: Nav links */}
            <div className="navbar-menu">
                <div className="navbar-links">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            to={link.href}
                            onClick={link.onClick ? link.onClick : undefined}
                            className={`nav-item${location.pathname === link.href || location.pathname.startsWith(`${link.href}/`) ?' nav-item--active' : ''}`}
                        >
                            {link.name}
                        </Link>
                    ))}
                    {user && (
                        <button type="button" onClick={handleLogout} className="nav-item nav-item--button">
                            ออกจากระบบ
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}
