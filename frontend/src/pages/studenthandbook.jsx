import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import bannerImage from '../assets/DomeBuilding.JPG';
import openBookIcon from '../assets/open-book.png';
import updateIcon from '../assets/calendar.png';
import PersonIcon from '../assets/user.png';
import DocIcon from '../assets/document.png';
import CaseIcon from '../assets/briefcase.png';
import './CSS/studenthandbook.css';

export default function Studenthandbook() {
  const [activeTab, setActiveTab] = useState('section1');

  const scrollToSection = (id) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      // Offset for sticky navbar
      const y = element.getBoundingClientRect().top + window.scrollY - 180;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="handbook-page-container">
      <Navbar />

      {/* Hero Banner */}
      <div className="handbook-banner">
        <img src={bannerImage} alt="Banner" className="handbook-banner-image" />
        <div className="handbook-banner-overlay">
          <div className="handbook-banner-content">
            <div className="handbook-banner-center">
              <img src={openBookIcon} alt="Book" className="handbook-banner-icon" />
              <div className="handbook-banner-text">
                <h1 className="handbook-banner-title">คู่มือนักศึกษา</h1>
                <p className="handbook-banner-subtitle">Student Handbook</p>
              </div>
            </div>

          </div>
          <div className="handbook-update-info">
            <img src={updateIcon} alt="Update" className="update-icon" />
            <div>
              <p>อัปเดตล่าสุด</p>
              <p>1 มกราคม 2568</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="handbook-content-wrapper">

        {/* Sidebar */}
        <aside className="handbook-sidebar">
          <div className="handbook-sidebar-header">
            <h3>สารบัญ</h3>
          </div>
          <ul className="handbook-sidebar-list">
            <li className={activeTab === 'section1' ? 'active' : ''} onClick={() => scrollToSection('section1')}>
              <div class="handbook-sidebar-number">01</div>การสมัครเข้าแผนสหกิจศึกษา
            </li>
            <li className={activeTab === 'section2' ? 'active' : ''} onClick={() => scrollToSection('section2')}>
              <div class="handbook-sidebar-number">02</div>กระบวนการเตรียมสหกิจศึกษา
            </li>
            <li className={activeTab === 'section3' ? 'active' : ''} onClick={() => scrollToSection('section3')}>
              <div class="handbook-sidebar-number">03</div>กิจกรรมและขั้นตอนระหว่างปฏิบัติสหกิจศึกษาในสหกิจศึกษา 1
            </li>
            <li className={activeTab === 'section4' ? 'active' : ''} onClick={() => scrollToSection('section4')}>
              <div class="handbook-sidebar-number">04</div>กิจกรรมและขั้นตอนระหว่างปฏิบัติสหกิจศึกษาในสหกิจศึกษา 2
            </li>
            <li className={activeTab === 'section5' ? 'active' : ''} onClick={() => scrollToSection('section5')}>
              <div class="handbook-sidebar-number">05</div>กระบวนการหลังการปฏิบัติสหกิจศึกษา
            </li>
            <li className={activeTab === 'section6' ? 'active' : ''} onClick={() => scrollToSection('section6')}>
              <div class="handbook-sidebar-number">06</div>แบบฟอร์มต่างๆสำหรับนักศึกษา
            </li>
          </ul>
        </aside>

        {/* Content Details */}
        <main className="handbook-main-content">

          {/* Section 1 */}
          <section id="section1" className="handbook-section-card">
            <h2 className="handbook-section-title">การจัดการเรียนสหกิจศึกษา</h2>
            <p className="handbook-section-desc">กำหนดการรับสมัคร ภาคเรียนที่ 1 ของแต่ละปีการศึกษา (ช่วงเดือนพฤศจิกายน)</p>

            <div className="handbook-section-content1">
              <p className="handbook-section-h2">เอกสารต่าง ๆ ที่ต้องจัดเตรียมในการสมัคร</p>
              <div className="handbook-info-box-group">
                <div className="handbook-info-box">
                  <img src={PersonIcon} alt="Person" className="info-box-icon" />
                  <div className="info-box-text">
                    <strong>1. รูปถ่ายนักศึกษา</strong>
                    <p>ในชุดสุภาพ หน้าตรง เห็นใบหน้าชัดเจนจนถึงหน้าอกช่วงบน (ตั้งชื่อ xxxxxxxxxx_photo.jpg โดย xxxxxxxxxxx คือรหัสนักศึกษา)</p>
                  </div>
                </div>
                <div className="handbook-info-box">
                  <img src={DocIcon} alt="Document" className="info-box-icon" />
                  <div className="info-box-text">
                    <strong>2. ทรานสคริปต์</strong>
                    <p>แสดงประวัติการลงทะเบียนและผลการศึกษาตั้งแต่ภาคการเรียนแรกที่เข้าศึกษา จนถึงภาคเรียนที่สมัครเข้าแผนสหกิจศึกษา (สามารถ save ไฟล์ PDF จากหน้าเว็บในระบบสำนักทะเบียน reg.tu.ac.th ได้ ตั้งชื่อ xxxxxxxxxx_transcript.pdf )</p>
                  </div>
                </div>
                <div className="handbook-info-box">
                  <img src={CaseIcon} alt="Case" className="info-box-icon" />
                  <div className="info-box-text">
                    <strong>3. Resume หรือ Curriculum Vitae (CV)</strong>
                    <p>แสดงประวัติและประสบการณ์ย่อของนักศึกษา (ตั้งชื่อ xxxxxxxxxx_resume.pdf หรือ xxxxxxxxxx_cv.pdf)</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="handbook-section-content1">
              <p className="handbook-section-h2">การคัดเลือกนักศึกษาเข้าแผนสหกิจศึกษา</p>
              <p>การคัดเลือกนักศึกษาเข้าแผนสหกิจฯ จะดำเนินการโดยคณะกรรมการบริหารสหกิจฯของสาขาวิชาฯ จำนวนของนักศึกษาที่ได้รับการคัดเลือกขึ้นอยู่กับคุณสมบัติของนักศึกษาและภาระงานของอาจารย์ในสาขาวิชาฯ (ดูจำนวนนักศึกษาในแผนสหกิจศึกษาย้อนหลัง) และผลการคัดเลือกจากคณะกรรมการบริหารสหกิจฯ ถือเป็นที่สิ้นสุด</p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="section2" className="handbook-section-card">
            <h2 className="handbook-section-title">กระบวนการเตรียมสหกิจศึกษา</h2>
            <p className="handbook-section-desc">ภายหลังจากที่สาขาวิชาฯ ประกาศผลการคัดเลือกนักศึกษาเข้าแผนสหกิจศึกษาในปีการศึกษานั้นแล้ว นักศึกษาที่ได้รับการคัดเลือกเข้าแผนฯ ทุกคน จะต้องดำเนินการต่อไปนี้</p>

            <div className="handbook-steps-container">
              <div className="handbook-step-item">
                <div className="handbook-step-number">1</div>
                <div className="handbook-step-content">
                  <strong>เข้าร่วมช่องทางสื่อสาร</strong>
                  <p>ในการดำเนินการสหกิจศึกษาของปีการศึกษานั้นภายใน 1-2 สัปดาห์หลังการประกาศผลตามที่คณะกรรมการฯ ประกาศ (**หากไม่ดำเนินการภายในกรอบเวลาดังกล่าวจะถูกตัดสิทธิ์ในการเข้าแผนสหกิจศึกษาโดยไม่มีข้อยกเว้น**) ลิงก์ช่องทางสื่อสารสำหรับแผนสหกิจศึกษาประจำปีการศึกษา 2569</p>
                </div>
              </div>

              <div className="handbook-step-item">
                <div className="handbook-step-number">2</div>
                <div className="handbook-step-content">
                  <strong>ลงทะเบียนวิชา คพ.302 เตรียมสหกิจศึกษา</strong>
                  <p>ในภาคเรียนถัดไป (ภาคเรียนที่ 2 ของปีการศึกษา) และสอบผ่านวิชา (ผลลัพธ์การเรียนรู้รายวิชา คพ.302 เตรียมสหกิจศึกษา) การเตรียมตัวก่อนออกไปปฏิบัติสหกิจศึกษาเป็นขั้นตอนสำคัญที่ช่วยให้นักศึกษามีความพร้อม ทั้งด้านความรู้ ทักษะ และทัศนคติ เพื่อสร้างความมั่นใจในการทำงานและเพิ่มโอกาสในการประสบความสำเร็จ นักศึกษา</p>

                  <div className="step-skill-group">
                    <strong>การเตรียมความรู้และทักษะ (Hard Skills)</strong>
                    <ul>
                      <li><strong>ศึกษาข้อมูลเกี่ยวกับสถานประกอบการ:</strong> เรียนรู้เกี่ยวกับประเภทธุรกิจ วัฒนธรรมองค์กร โครงสร้างการทำงาน และผลิตภัณฑ์หรือบริการของสถานประกอบการ</li>
                      <li><strong>ทำความเข้าใจกับบทบาทและหน้าที่ที่ได้รับมอบหมาย:</strong> อ่านและศึกษารายละเอียดของงานที่ได้รับให้ถี่ถ้วน พร้อมเตรียมแผนการเรียนรู้เพิ่มเติมในส่วนที่ยังไม่คุ้นเคย</li>
                      <li><strong>ฝึกทักษะที่เกี่ยวข้องกับงาน:</strong> ทบทวนความรู้ทางวิชาการหรือเครื่องมือที่จำเป็น เช่น การใช้ซอฟต์แวร์ การวิเคราะห์ข้อมูล หรือการเขียนรายงาน</li>
                      <li><strong>ฝึกการแก้ปัญหาและการทำงานจริง:</strong> ทำแบบฝึกหัดหรือโครงการจำลองเพื่อเตรียมตัวรับมือกับงานที่อาจเกิดขึ้น</li>
                    </ul>
                  </div>

                  <div className="step-skill-group">
                    <strong>การเตรียมทักษะส่วนบุคคล (Soft Skills)</strong>
                    <ul>
                      <li><strong>ฝึกการสื่อสาร:</strong> ฝึกทักษะการพูด การเขียน และการสื่อสารในที่ทำงาน รวมถึงการฟังอย่างตั้งใจ</li>
                      <li><strong>พัฒนาทักษะการทำงานเป็นทีม:</strong> เตรียมตัวทำงานร่วมกับผู้อื่น ฝึกการรับฟังความคิดเห็นและการปรับตัวให้เข้ากับบุคลิกของเพื่อนร่วมงาน</li>
                      <li><strong>เรียนรู้การบริหารเวลา:</strong> ฝึกวางแผนและจัดลำดับความสำคัญของงาน เพื่อให้สามารถปฏิบัติงานได้ตามกำหนด</li>
                      <li><strong>เสริมสร้างวินัยและความรับผิดชอบ:</strong> ปลูกฝังนิสัยตรงต่อเวลา และปฏิบัติตามกฎระเบียบหรือคำแนะนำ</li>
                      <li><strong>ฝึกทักษะการสื่อสารด้วยภาษาอังกฤษ:</strong> ฝึกการพูด ฟัง อ่าน และเขียนในหัวข้อที่เกี่ยวข้องกับงาน เช่น การแนะนำตัว การเขียนอีเมล และการรายงานผลการทำงาน ใช้แหล่งเรียนรู้ออนไลน์หรือแอปพลิเคชัน เช่น Duolingo หรือ Grammarly รวมถึงฝึกการสนทนาในชีวิตประจำวัน เพื่อเพิ่มความมั่นใจในการสื่อสารและสามารถปรับตัวในสถานประกอบการที่มีการใช้ภาษาอังกฤษได้อย่างมีประสิทธิภาพ</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="handbook-step-item">
                <div className="handbook-step-number">3</div>
                <div className="handbook-step-content">
                  <strong>ติดต่อสถานประกอบการ</strong>
                  <p>สมัครงานในตำแหน่งงานสหกิจศึกษาที่สถานประกอบการประกาศไว้ (ช่วงประมาณระหว่างเดือน ธันวาคม ถึง เมษายน) รายชื่อสถานประกอบการที่ขึ้นทะเบียนมีความร่วมมือในแผนสหกิจศึกษาไว้กับทางสาขาวิชาฯ ทั้งนี้หลักสูตรฯ จะยอมรับการปฏิบัติสหกิจศึกษาเฉพาะกับสถานประกอบการที่มีการขึ้นทะเบียนไว้กับทางสาขาวิชาฯ เท่านั้น หากนักศึกษาประสงค์จะปฏิบัติสหกิจศึกษากับสถานประกอบการอื่น ซึ่งยังไม่ได้ขึ้นทะเบียน จะต้องติดต่อสถานประกอบการให้ติดต่อมายังเจ้าหน้าที่แผนสหกิจศึกษา คุณพัชรัตน์ มีมะโน ที่ Email : meemano@tu.ac.th, patcharat_m@sci.tu.ac.th หรือแจ้งรายละเอียดการติดต่อกับสถานประกอบการที่เจ้าหน้าที่แผนสหกิจศึกษาเพื่อประสานงานไปยังสถานประกอบการเพื่อขอขึ้นทะเบียนก่อนภายในวันที่กำหนด (**สาขาวิชาฯขอสงวนสิทธิ์ในการพิจารณาขึ้นทะเบียนสถานประกอบการที่มีความร่วมมือในแผนสหกิจศึกษาตามแต่สาขาวิชาฯ พิจารณาเห็นสมควร**) ช่วงเวลาในการปฏิบัติสหกิจศึกษาของแต่ละปีการศึกษาเป็นไปตามปฏิทินภาคการศึกษาที่ประกาศโดยมหาวิทยาลัยธรรมศาสตร์ โดยปกติจะนับตั้งแต่วันเริ่มภาคเรียน Summer ของปีการศึกษาถัดไป จนถึงวันที่สิ้นสุดภาคเรียนที่ 1 ของปีการศึกษาถัดไป (เช่นนักศึกษาที่สมัครเข้าแผนสหกิจศึกษาในภาคเรียน 1/2567 จะปฏิบัติสหกิจศึกษาในภาคเรียน Summer/2568 (สหกิจศึกษา 1) และในภาคเรียน 1/2568 (สหกิจศึกษา 2) ทั้งนี้อาจจะปรับยืดหยุ่นจากกำหนดนี้ได้เล็กน้อย (+- 1 สัปดาห์) แต่ต้องมีระยะเวลาปฏิบัติสหกิจศึกษาต่อเนื่องไม่น้อยกว่า 6 เดือน</p>
                </div>
              </div>

              <div className="handbook-step-item">
                <div className="handbook-step-number">4</div>
                <div className="handbook-step-content">
                  <strong>แจ้งข้อมูลแก่เจ้าหน้าที่แผนสหกิจศึกษา</strong>
                  <p>เมื่อได้ตอบรับตำแหน่งงานสหกิจศึกษากับสถานประกอบการแล้ว รอประกาศสรุปรายชื่อนักศึกษาและสถานประกอบการที่จะดำเนินการปฏิบัติสหกิจศึกษาสำหรับปีการศึกษานั้น (อย่างไม่เป็นทางการ) ที่จะอัพเดตอย่างช้าทุก 2 สัปดาห์</p>
                </div>
              </div>

              <div className="handbook-step-item">
                <div className="handbook-step-number">5</div>
                <div className="handbook-step-content">
                  <strong>ตรวจสอบประกาศ</strong>
                  <p>ตรวจสอบประกาศสรุปรายชื่อนักศึกษาและสถานประกอบการที่จะดำเนินการปฏิบัติสหกิจศึกษาสำหรับปีการศึกษานั้น (อย่างเป็นทางการ) ช่วงประมาณเดือนเมษายน ซึ่งอาจมีการตัดรายชื่อนักศึกษาที่ไม่เป็นไปตามเงื่อนไขข้อ 2. (เมื่อได้รับแจ้งจากอาจารย์ผู้สอนว่าจะสอบไม่ผ่านวิชา คพ.302)ออกไป เฉพาะนักศึกษาที่อยู่ในประกาศนี้เท่านั้นที่สามารถลงทะเบียนวิชาคพ.303 สหกิจ 1 และสามารถปฏิบัติสหกิจศึกษาได้</p>
                </div>
              </div>
              
              <div className="handbook-step-item">
                <div className="handbook-step-number">6</div>
                <div className="handbook-step-content">
                  <strong>เข้าร่วมการปฐมนิเทศสหกิจศึกษาประจำปีการศึกษา</strong>
                  <p>เพื่อรับฟังการชี้แจงเกณฑ์ เงื่อนไขต่าง ๆ แจ้งรายชื่ออาจารย์ที่ปรึกษา และกระบวนการในการปฏิบัติสหกิจศึกษา 1 และ 2 (**นักศึกษาที่ไม่เข้าร่วมการปฐมนิเทศฯ จะต้องถอนรายวิชาคพ.304 สหกิจ 1 มิฉะนั้นจะถือว่าสอบไม่ผ่านรายวิชานี้**)</p>
                </div>
              </div>
            </div>
          </section>
          
          {/* Section 3 */}
          <section id="section3" className="handbook-section-card">
            <h2 className="handbook-section-title">กิจกรรมและขั้นตอนระหว่างปฏิบัติสหกิจศึกษา ในสหกิจศึกษา 1</h2>
            <p className="handbook-section-desc">นักศึกษาสหกิจศึกษาทุกคนจะต้องดำเนินการต่อไปนี้</p>

            <div className="handbook-step-content" style={{ marginTop: '1.5rem' }}>
              <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem', color: '#4b5563', fontSize: '0.9rem', lineHeight: '1.6' }}>
                <li><strong>ลงทะเบียนรายวิชาคพ.304 สหกิจศึกษา 1</strong> ในภาคเรียน Summer ของปีการศึกษาถัดไป</li>
                <li><strong>รายงานตัวพร้อมใบส่งตัวนักศึกษาสหกิจศึกษา</strong> ณ สถานประกอบการ เพื่อเริ่มการปฏิบัติสหกิจศึกษาในวันที่แจ้งไว้กับหลักสูตรฯ</li>
                <li><strong>เข้ารับการปฐมนิเทศการปฏิบัติงานหรือการอบรมเบื้องต้นต่าง ๆ</strong> ตามสถานประกอบการเห็นสมควร และแจ้งข้อมูลเจ้าหน้าที่ที่ปรึกษา (Supervisor) ที่จะให้คำแนะนำแก่นักศึกษาในระหว่างปฏิบัติสหกิจศึกษามายังเจ้าหน้าที่แผนสหกิจศึกษาภายใน 1 สัปดาห์หลังเริ่มปฏิบัติงาน</li>
                <li><strong>ตรวจสอบข้อมูลอาจารย์ที่ปรึกษาจากหลักสูตรฯ</strong> ที่มีการมอบหมายให้คำแนะนำร่วมแก่นักศึกษา และติดต่ออาจารย์ที่ปรึกษาเพื่อรายงานตัว <span style={{ color: '#ef4444', fontWeight: 'bold' }}>ไม่เกิน 1 สัปดาห์</span>หลังเริ่มปฏิบัติงาน</li>
                <li>
                  <strong>นักศึกษาปฏิบัติสหกิจศึกษาด้วยชุดความคิดว่าการปฏิบัติสหกิจศึกษาเป็นโอกาสที่สำคัญในการพัฒนาตนเอง</strong> ทั้งในด้านความรู้ ความสามารถ และทักษะที่จำเป็นต่อการทำงานในอนาคต นักศึกษาพึงปฏิบัติตนด้วยความรับผิดชอบ เพียรพยายาม มีวินัย และสุภาพ เพื่อสร้างผลลัพธ์ที่ดีที่สุดต่อตนเองและสถานประกอบการ รวมทั้งเพื่อให้บรรลุผลลัพธ์การเรียนรู้ของรายวิชาคพ.303 สหกิจศึกษา 1
                  
                  <div className="step-skill-group">
                    <strong>การพัฒนาทักษะด้าน Hard Skills:</strong>
                    <ul>
                      <li><strong>ตั้งเป้าหมายในการเรียนรู้:</strong> ศึกษาและปฏิบัติงานตามบทบาทที่ได้รับมอบหมายด้วยความตั้งใจ ค้นคว้าหาความรู้เพิ่มเติมที่เกี่ยวข้องกับงานที่ได้รับ</li>
                      <li><strong>ใช้เครื่องมือและเทคโนโลยีอย่างเชี่ยวชาญ:</strong> ฝึกฝนการใช้เครื่องมือหรือซอฟต์แวร์ที่จำเป็นต่อการปฏิบัติงานอย่างถูกต้องและมีประสิทธิภาพ</li>
                      <li><strong>วิเคราะห์และแก้ปัญหา:</strong> ฝึกการคิดเชิงวิเคราะห์ เรียนรู้กระบวนการแก้ปัญหา และปรับตัวให้ทันต่อสถานการณ์ที่เปลี่ยนแปลง</li>
                      <li><strong>พัฒนาผลงาน:</strong> ส่งมอบงานคุณภาพให้ตรงตามเป้าหมายของสถานประกอบการ</li>
                    </ul>
                  </div>

                  <div className="step-skill-group">
                    <strong>การพัฒนาทักษะด้าน Soft Skills:</strong>
                    <ul>
                      <li><strong>มีความรับผิดชอบ:</strong> เข้าปฏิบัติงานตรงเวลา ส่งงานตามกำหนด และรายงานผลการดำเนินงานอย่างสม่ำเสมอ</li>
                      <li><strong>สื่อสารอย่างมีประสิทธิภาพ:</strong> สื่อสารกับเจ้าหน้าที่ที่ปรึกษา หัวหน้างาน เพื่อนร่วมงาน และผู้เกี่ยวข้อง รวมทั้งอาจารย์ที่ปรึกษาอย่างสุภาพ มั่นใจ ชัดเจน และตรงประเด็น</li>
                      <li><strong>ทำงานเป็นทีม:</strong> ให้ความร่วมมือกับทีมงาน มีทัศนคติเชิงบวก และพร้อมช่วยเหลือเพื่อนร่วมงาน</li>
                      <li><strong>มีความอดทนและมุ่งมั่น:</strong> ทำงานด้วยความเพียรพยายาม รับมือกับความกดดัน และไม่ย่อท้อต่ออุปสรรค</li>
                      <li><strong>แสดงความสุภาพและความนอบน้อม:</strong> ปฏิบัติตนตามกฎระเบียบของสถานประกอบการ และรักษามารยาทในการทำงาน</li>
                      <li><strong>เปิดใจรับฟังคำแนะนำและนำไปพัฒนาตนเอง:</strong> เปิดใจรับฟังคำแนะนำและข้อเสนอแนะจากอาจารย์และเจ้าหน้าที่ที่ปรึกษา และผู้อื่นที่เกี่ยวข้อง พร้อมทั้งนำความคิดเห็นที่ได้รับไปปรับปรุงงานและพัฒนาตนเอง</li>
                    </ul>
                  </div>
                </li>
                <li>
                  <strong>ส่งรายงานความคืบหน้าของการปฏิบัติงานอย่างต่อเนื่องให้กับอาจารย์ที่ปรึกษา ดังนี้</strong>
                  <div className="step-skill-group" style={{ marginTop: '0.5rem' }}>
                    <strong>ช่วงเวลาโดยประมาณ: สิ่งที่ต้องส่ง</strong>
                    <ul>
                      <li>วันที่ 10 ของเดือนถัดจากที่เริ่มปฏิบัติงาน: นักศึกษาส่งโครงร่างหัวข้อการปฏิบัติสหกิจศึกษา และแผนปฏิบัติสหกิจศึกษา</li>
                      <li>ทุกวันที่ 10 ของเดือนถัดมา : นักศึกษาส่งรายงานผลการปฏิบัติสหกิจศึกษาของช่วงเดือนที่ผ่านมาให้แก่อาจารย์ที่ปรึกษา</li>
                    </ul>
                  </div>
                </li>
                <li><strong>ประสานงานกับเจ้าหน้าที่ที่ปรึกษา และอาจารย์ที่ปรึกษาในการนิเทศสหกิจศึกษาครั้งที่ 1</strong> (ช่วงประมาณเดือนกรกฎาคม)</li>
                <li><strong>จัดส่งรายงานเค้าโครงการปฏิบัติสหกิจศึกษา</strong> (ประมาณเดือนสิงหาคม)</li>
              </ol>
            </div>
            
            {/* กล่องหมายเหตุ */}
            <div className="handbook-step-content" style={{ marginTop: '1rem', borderColor: '#fed7aa', backgroundColor: '#fffbf1' }}>
              <p style={{ color: '#ea580c', margin: 0, fontSize: '16px', lineHeight: '1.6' }}>
                <strong>หมายเหตุ</strong> นักศึกษาที่สอบผ่านคพ.304 สหกิจศึกษา 1 เท่านั้นจึงจะสามารถลงทะเบียนวิชาคพ.404 ในภาคเรียนต่อไปได้ <br/>
                ทั้งนี้ นักศึกษาที่ไม่เข้าเงื่อนไขด้วยสาเหตุใดก็แล้วแต่ สามารถลงทะเบียนวิชาคพ.403 โครงงานพิเศษ 1 ได้หากเป็นไปตามเงื่อนไขวิชาศึกษาก่อนของคพ.403
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section id="section4" className="handbook-section-card">
            <h2 className="handbook-section-title">กิจกรรมและขั้นตอนระหว่างปฏิบัติสหกิจศึกษา ในสหกิจศึกษา 2</h2>
            <p className="handbook-section-desc">นักศึกษาสหกิจศึกษาทุกคนที่สอบผ่าน คพ.304 สหกิจศึกษา 1 จะต้องดำเนินการต่อไปนี้</p>

            <div className="handbook-step-content" style={{ marginTop: '1.5rem' }}>
              <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem', color: '#4b5563', fontSize: '0.9rem', lineHeight: '1.6' }}>
                <li><strong>ลงทะเบียนรายวิชาคพ.404 สหกิจศึกษา 2</strong> ในภาคเรียน 1 ของปีการศึกษาถัดไป</li>
                <li>
                  <strong>นักศึกษาปฏิบัติสหกิจศึกษาด้วยชุดความคิดว่าการปฏิบัติสหกิจศึกษาเป็นโอกาสที่สำคัญในการพัฒนาตนเอง</strong> ทั้งในด้านความรู้ ความสามารถ และทักษะที่จำเป็นต่อการทำงานในอนาคต นักศึกษาพึงปฏิบัติตนด้วยความรับผิดชอบ เพียรพยายาม มีวินัย และสุภาพ เพื่อสร้างผลลัพธ์ที่ดีที่สุดต่อตนเองและสถานประกอบการ รวมทั้งเพื่อให้บรรลุผลลัพธ์การเรียนรู้ของรายวิชาคพ.303 สหกิจศึกษา 2
                  
                  <div className="step-skill-group">
                    <strong>การพัฒนาทักษะด้าน Hard Skills:</strong>
                    <ul>
                      <li><strong>ตั้งเป้าหมายในการเรียนรู้:</strong> ศึกษาและปฏิบัติงานตามบทบาทที่ได้รับมอบหมายด้วยความตั้งใจ ค้นคว้าหาความรู้เพิ่มเติมที่เกี่ยวข้องกับงานที่ได้รับ</li>
                      <li><strong>ใช้เครื่องมือและเทคโนโลยีอย่างเชี่ยวชาญ:</strong> ฝึกฝนการใช้เครื่องมือหรือซอฟต์แวร์ที่จำเป็นต่อการปฏิบัติงานอย่างถูกต้องและมีประสิทธิภาพ</li>
                      <li><strong>วิเคราะห์และแก้ปัญหา:</strong> ฝึกการคิดเชิงวิเคราะห์ เรียนรู้กระบวนการแก้ปัญหา และปรับตัวให้ทันต่อสถานการณ์ที่เปลี่ยนแปลง</li>
                      <li><strong>พัฒนาผลงาน:</strong> ส่งมอบงานคุณภาพให้ตรงตามเป้าหมายของสถานประกอบการ</li>
                    </ul>
                  </div>

                  <div className="step-skill-group">
                    <strong>การพัฒนาทักษะด้าน Soft Skills:</strong>
                    <ul>
                      <li><strong>มีความรับผิดชอบ:</strong> เข้าปฏิบัติงานตรงเวลา ส่งงานตามกำหนด และรายงานผลการดำเนินงานอย่างสม่ำเสมอ</li>
                      <li><strong>สื่อสารอย่างมีประสิทธิภาพ:</strong> สื่อสารกับเจ้าหน้าที่ที่ปรึกษา หัวหน้างาน เพื่อนร่วมงาน และผู้เกี่ยวข้อง รวมทั้งอาจารย์ที่ปรึกษาอย่างสุภาพ มั่นใจ ชัดเจน และตรงประเด็น</li>
                      <li><strong>ทำงานเป็นทีม:</strong> ให้ความร่วมมือกับทีมงาน มีทัศนคติเชิงบวก และพร้อมช่วยเหลือเพื่อนร่วมงาน</li>
                      <li><strong>มีความอดทนและมุ่งมั่น:</strong> ทำงานด้วยความเพียรพยายาม รับมือกับความกดดัน และไม่ย่อท้อต่ออุปสรรค</li>
                      <li><strong>แสดงความสุภาพและความนอบน้อม:</strong> ปฏิบัติตนตามกฎระเบียบของสถานประกอบการ และรักษามารยาทในการทำงาน</li>
                      <li><strong>เปิดใจรับฟังคำแนะนำและนำไปพัฒนาตนเอง:</strong> เปิดใจรับฟังคำแนะนำและข้อเสนอแนะจากอาจารย์และเจ้าหน้าที่ที่ปรึกษา และผู้อื่นที่เกี่ยวข้อง พร้อมทั้งนำความคิดเห็นที่ได้รับไปปรับปรุงงานและพัฒนาตนเอง</li>
                    </ul>
                  </div>
                </li>
                <li><strong>ส่งรายงานความคืบหน้าของการปฏิบัติงานของเดือนที่ผ่านมาอย่างต่อเนื่องให้อาจารย์ที่ปรึกษา</strong> ภายในทุกวันที่ 10 ของเดือน ตั้งแต่กันยายน ถึง พฤศจิกายน</li>
                <li><strong>ประสานงานกับเจ้าหน้าที่ที่ปรึกษา และอาจารย์ที่ปรึกษาในการนิเทศสหกิจศึกษาครั้งที่ 2</strong> (ช่วงประมาณเดือนพฤศจิกายนถึงธันวาคม)</li>
                <li><strong>นักศึกษาปฏิบัติงานจนถึงวันสุดท้ายของการปฏิบัติสหกิจศึกษาตามที่แจ้งไว้กับหลักสูตรฯ</strong></li>
                <li><strong>นักศึกษาส่งไฟล์ poster, abstract, slides</strong> และรายงานการปฏิบัติงานสหกิจศึกษาให้อาจารย์ที่ปรึกษาตรวจสอบและให้คำแนะนำตั้งแต่หลังการนิเทศสหกิจศึกษาครั้งที่ 2</li>
              </ol>
            </div>
          </section>

          {/* Section 5 */}
          <section id="section5" className="handbook-section-card">
            <h2 className="handbook-section-title">กระบวนการหลังการปฏิบัติสหกิจศึกษา</h2>
            <p className="handbook-section-desc">นักศึกษาที่ปฏิบัติสหกิจศึกษาเสร็จสิ้นตามกำหนดเวลาที่แจ้งกับหลักสูตรฯ แล้ว จะต้องดำเนินการต่อไปนี้</p>

            <div className="handbook-steps-container">
              <div className="handbook-step-item">
                <div className="handbook-step-number">1</div>
                <div className="handbook-step-content">
                  <strong>รายงานตัวพร้อมกับส่งรายงานการปฏิบัติงานสหกิจศึกษาฉบับสมบูรณ์</strong>
                  <p>กับเจ้าหน้าที่แผนสหกิจศึกษาที่สาขาวิชาฯ ภายในวันที่กำหนดของปีการศึกษานั้น</p>
                </div>
              </div>

              <div className="handbook-step-item">
                <div className="handbook-step-number">2</div>
                <div className="handbook-step-content">
                  <strong>เข้าร่วมประชุม</strong>
                  <p>ชี้แจงเกี่ยวกับการจัดแสดงผลงานในนิทรรศการสหกิจศึกษา</p>
                </div>
              </div>

              <div className="handbook-step-item">
                <div className="handbook-step-number">3</div>
                <div className="handbook-step-content">
                  <strong>เข้าร่วมการปัจฉิมนิเทศ และจัดแสดงผลงานในนิทรรศการสหกิจศึกษา</strong>
                  <p>ตามวันและเวลาที่หลักสูตรฯ กำหนด<br/>
                    <span style={{ color: '#3b82f6', marginTop: '0.25rem', display: 'inline-block' }}>(**นักศึกษาที่ไม่ปฏิบัติตามข้อนี้ จะถือว่าไม่ผ่านรายวิชาคพ.304 สหกิจศึกษา 2 โดยไม่มีข้อยกเว้น**)</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section id="section6" className="handbook-section-card">
            <h2 className="handbook-section-title">แบบฟอร์มต่าง ๆ สำหรับนักศึกษา</h2>
            
            <div className="handbook-document-list">
              {[
                { id: 'CSTU-COOP-S01', name: 'แบบคำร้องขอสมัครเข้าแผนสหกิจศึกษา', type: 'tag-orange' },
                { id: 'CSTU-COOP-S02', name: 'แบบฟอร์มนักศึกษาแจ้งข้อมูลสถานประกอบการเพื่อพิจารณาขึ้นทะเบียน', type: 'tag-orange' },
                { id: 'CSTU-COOP-S03', name: 'แบบฟอร์มนักศึกษาแจ้งข้อมูลผลการสมัครเข้าปฏิบัติงานสหกิจศึกษา', type: 'tag-orange' },
                { id: 'CSTU-COOP-S04', name: 'แบบฟอร์มนักศึกษาแจ้งสถานะการสมัครเข้าปฏิบัติงานสหกิจศึกษา', type: 'tag-orange' },
                { id: 'CSTU-COOP-S05', name: 'แบบฟอร์มนักศึกษาส่งเอกสาร PDF ที่ได้รับหลังจากกรอกแบบฟอร์มคณะฯ', type: 'tag-orange' },
                { id: 'CSTU-COOP-S06', name: 'แบบฟอร์มนักศึกษากรอกแบบฟอร์ม หนังสือยืนยันการรับทราบจากผู้ปกครอง', type: 'tag-orange' },
                { id: 'CSTU-COOP-S07', name: 'แบบฟอร์มลงทะเบียนปฐมนิเทศนักศึกษาสหกิจศึกษา', type: 'tag-orange' },
                { id: 'CSTU-COOP-S08', name: 'แบบฟอร์มแจ้งแผนการปฏิบัติงานสหกิจศึกษา', type: 'tag-orange' },
                { id: 'CSTU-COOP-S09', name: 'แบบฟอร์มแจ้งหัวข้อโครงงานสำหรับการปฏิบัติสหกิจศึกษา', type: 'tag-orange' },
                { id: 'CSTU-COOP-S10', name: 'ส่งรายงานผลการปฏิบัติสหกิจศึกษาเดือนสิงหาคม', type: 'tag-green' },
                { id: 'CSTU-COOP-S11', name: 'ส่งรายงานผลการปฏิบัติสหกิจศึกษาเดือนกันยายน', type: 'tag-green' },
                { id: 'CSTU-COOP-S12', name: 'ส่งรายงานผลการปฏิบัติสหกิจศึกษาเดือนตุลาคม', type: 'tag-green' },
                { id: 'CSTU-COOP-S13', name: 'ส่งรายงานผลการปฏิบัติสหกิจศึกษาเดือนพฤศจิกายน', type: 'tag-green' },
                { id: 'CSTU-COOP-S14', name: 'ส่งแบบฟอร์มขอนิเทศออนไลน์ (เฉพาะกรณีจำเป็นเท่านั้น)', type: 'tag-green' },
                { id: 'CSTU-COOP-S15', name: (
                  <>
                    ส่ง 1.File poster<br/>
                    2.File present<br/>
                    3.File Abstract<br/>
                    4. File QR Code<br/>
                    5.ไฟล์ word ที่มี link ของ QR Code ทั้ง 3 ไฟล์
                  </>
                ), type: 'tag-green' },
                { id: 'CSTU-COOP-S16', name: (
                  <>
                    ส่งรายงานผลการปฏิบัติสหกิจศึกษาฉบับสมบูรณ์ พร้อมลายเซ็นพนักงานที่ปรึกษา<br/>
                    ลายเซ็นอาจารย์ที่ปรึกษาและกรรมการทุกคน
                  </>
                ), type: 'tag-orange' },
                { id: 'CSTU-COOP-S17', name: 'แบบฟอร์มแบบสอบถามนักศึกษาสหกิจศึกษา (หลังกลับจากการปฏิบัติสหกิจ)', type: 'tag-orange' },
              ].map((doc, index) => (
                <div key={index} className="handbook-document-item">
                  <div className="doc-item-left">
                    <span className={`doc-item-id ${doc.type}`}>
                      {doc.id}
                    </span>
                    <span className="doc-item-name">{doc.name}</span>
                  </div>
                  <button className="doc-item-btn">
                    คลิกเพื่อดูเพิ่มเติม <span>→</span>
                  </button>
                </div>
              ))}
            </div>

            <h3 className="handbook-sub-section-title">
              แบบฟอร์มอื่นๆ
            </h3>
            
            <div className="handbook-document-list">
              {[
                { id: 'CSTU-COOP', name: 'แบบฟอร์มสละสิทธิ์หรือขอยุติการไปปฏิบัติสหกิจ' },
                { id: 'CSTU-COOP', name: 'แบบฟอร์มลาสหกิจ' },
                { id: 'CSTU-COOP', name: 'แบบฟอร์มขอนิเทศออนไลน์' },
              ].map((doc, index) => (
                <div key={`other-${index}`} className="handbook-document-item">
                  <div className="doc-item-left">
                    <span className="doc-item-id tag-gray">
                      {doc.id}
                    </span>
                    <span className="doc-item-name">{doc.name}</span>
                  </div>
                  <button className="doc-item-btn">
                    คลิกเพื่อดูเพิ่มเติม <span>→</span>
                  </button>
                </div>
              ))}
            </div>
          </section>

        </main>
      </div>

      <Footer />
    </div>
  );
}

