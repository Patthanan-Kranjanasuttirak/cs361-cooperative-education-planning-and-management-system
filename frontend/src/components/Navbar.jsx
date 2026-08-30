import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/CSTU-LOGO.png';
import './CSS/Navbar.css';

export default function Navbar() {
    const location = useLocation();

    const navLinks = [
        { name: 'หน้าแรก', href: '/' },
        { name: 'เกี่ยวกับ', href: '#' },
        { name: 'คู่มือนักศึกษา', href: '#' },
        { name: 'คู่มือสหกิจศึกษา', href: '#' },
        { name: 'ติดต่อ', href: '#' },
    ];

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
                            className={`nav-item${location.pathname === link.href ? ' nav-item--active' : ''}`}
                        >
                            {link.name}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}
