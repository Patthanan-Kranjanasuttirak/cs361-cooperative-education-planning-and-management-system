import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { ROLES } from '../config/roles';
import logo from '../assets/CSTU-LOGO.png';
import userIcon from '../assets/user.png';
import './CSS/Navbar.css';

export default function Navbar() {
    const location = useLocation();
    const { user, logout } = useAuth();
    const [failedAvatar, setFailedAvatar] = useState(null);
    const displayName = user?.th_name || user?.email?.split('@')[0] || 'ผู้ใช้งาน';
    const avatarUrl = user?.avatar_url;
    const hasAvatar = Boolean(avatarUrl && failedAvatar !== avatarUrl);
    const accountRef = useRef(null);
    const accountButtonRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        const closeOutside = (event) => {
            if (!accountRef.current?.contains(event.target)) accountRef.current?.removeAttribute('open');
        };
        const closeOnEscape = (event) => {
            if (event.key === 'Escape' && accountRef.current?.open) {
                accountRef.current.removeAttribute('open');
                accountButtonRef.current?.focus();
            }
        };
        document.addEventListener('pointerdown', closeOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [user]);

    useEffect(() => {
        accountRef.current?.removeAttribute('open');
    }, [location.key]);

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
        ...(user ? [{ name: 'หน้าของฉัน', href: ROLES[user.role].home }] : []),
    ];

    // อยู่หน้าสาธารณะก็อยู่หน้าเดิม อยู่หน้าที่ต้อง login ProtectedRoute จะพาไป /login เอง
    const handleLogout = () => {
        accountRef.current?.removeAttribute('open');
        logout();
    };

    return (
        <nav className={`navbar${user ? ' navbar--authenticated' : ' navbar--guest'}`}>
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
                    {user ? (
                        <details className="navbar-account" ref={accountRef}
                            onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute('open');
                            }}>
                            <summary className="navbar-account-trigger" ref={accountButtonRef} aria-label={`เมนูบัญชีผู้ใช้: ${displayName}`}>
                                <span className={`navbar-user-icon${hasAvatar ? ' navbar-user-icon--photo' : ''}`}>
                                    <img src={hasAvatar ? avatarUrl : userIcon} alt=""
                                        onError={hasAvatar ? () => setFailedAvatar(avatarUrl) : undefined} />
                                </span>
                                <span className="navbar-account-text">
                                    <span className="navbar-account-name" title={displayName}>{displayName}</span>
                                    <span className="navbar-account-email" title={user.email}>{user.email}</span>
                                </span>
                                <svg className="navbar-account-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </summary>
                            <div className="navbar-account-dropdown">
                                <button type="button" onClick={handleLogout} className="navbar-account-action navbar-account-logout">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M14 8l4 4-4 4m-6-4h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    ออกจากระบบ
                                </button>
                            </div>
                        </details>
                    ) : (
                        <Link to="/login" className="navbar-login-link">
                            <span className="navbar-login-button">เข้าสู่ระบบ</span>
                            <span className="navbar-user-icon" aria-hidden="true">
                                <img src={userIcon} alt="" />
                            </span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Bottom bar: Nav links */}
            <div className="navbar-menu">
                <div className="navbar-links">
                    <div className="navbar-primary-links">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                to={link.href}
                                className={`nav-item${location.pathname === link.href || location.pathname.startsWith(`${link.href}/`) ?' nav-item--active' : ''}`}
                            >
                                {link.name}
                            </Link>
                        ))}
                        <a href="#footer" onClick={handleContactClick} className="nav-item navbar-contact-link">
                            ติดต่อ
                        </a>
                    </div>
                </div>
            </div>
        </nav>
    );
}
