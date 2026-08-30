import wLogo from '../assets/W-CSTU-LOGO.png';
import './CSS/Footer.css';

export default function Footer() {
    return (
        <footer id="footer" className="footer">
            <div className="footer-container">
                <div className="footer-logo-section">
                    <img src={wLogo} alt="CSTU Logo" className="footer-logo-img" />
                </div>
                <div className="footer-info-section">
                    <p className="footer-title">
                        สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยธรรมศาสตร์ ศูนย์รังสิต
                    </p>
                    <p className="footer-text">
                        99 ถ.พหลโยธิน อ.คลองหนึ่ง ต.คลองหลวง จ.ปทุมธานี 12120
                    </p>
                    <p className="footer-text">
                        โทรศัพท์ : 0-2986-9154, 0-2986-9156, 0-2986-9138-39, 0-2564-4440-59 ต่อ 2157, 2714
                    </p>
                    <p className="footer-text">
                        Email: <a href="mailto:scitu_cs@sci.tu.ac.th">scitu_cs@sci.tu.ac.th</a> Facebook: <a href="https://www.facebook.com/CSTUadmissioncenter" target="_blank" rel="noopener noreferrer">@CSTUadmissioncenter</a>
                    </p>
                </div>
            </div>
            <div className="footer-divider"></div>
        </footer>
    );
}
