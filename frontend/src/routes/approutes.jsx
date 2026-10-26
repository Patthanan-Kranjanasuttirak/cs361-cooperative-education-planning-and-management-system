import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthProvider from '../context/AuthProvider';
import ProtectedRoute from './ProtectedRoute';
import RoleLayout from '../layouts/RoleLayout';
import Home from '../pages/home';
import Company from '../pages/company';
import Studenthandbook from '../pages/studenthandbook';
import Login from '../pages/Login';
import MyApplications from '../pages/student/MyApplications';
import Apply from '../pages/student/Apply';
import Profile from '../pages/student/Profile';
import PendingApplications from '../pages/advisor/PendingApplications';
import MyStudents from '../pages/advisor/MyStudents';
import StudentDetail from '../pages/advisor/StudentDetail';
import AllApplications from '../pages/staff/AllApplications';
import ManageCompanies from '../pages/staff/ManageCompanies';
import ManageTerms from '../pages/staff/ManageTerms';
import ManageUsers from '../pages/staff/ManageUsers';
import VerifyStudents from '../pages/staff/VerifyStudents';
import Applicants from '../pages/company-portal/Applicants';
import CompanyPositions from '../pages/company-portal/CompanyPositions';
import CompanyProfile from '../pages/company-portal/CompanyProfile';

export default function approutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* หน้าสาธารณะ ไม่ต้อง login */}
          <Route path="/" element={<Home />} />
          <Route path="/detail/:id" element={<Home />} />
          <Route path="/company" element={<Company />} />
          <Route path="/company/:id" element={<Company />} />
          <Route path="/student-handbook" element={<Studenthandbook />} />
          <Route path="/login" element={<Login />} />

          {/* หน้าตามบทบาท (เมนูอยู่ใน config/roles.js) */}
          <Route element={<ProtectedRoute roles={['student']} />}>
            <Route path="/student" element={<RoleLayout />}>
              <Route index element={<MyApplications />} />
              <Route path="apply" element={<Apply />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['advisor']} />}>
            <Route path="/advisor" element={<RoleLayout />}>
              <Route index element={<PendingApplications />} />
              <Route path="students" element={<MyStudents />} />
              <Route path="students/:studentId" element={<StudentDetail />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['staff']} />}>
            <Route path="/staff" element={<RoleLayout />}>
              <Route index element={<AllApplications />} />
              <Route path="students" element={<VerifyStudents />} />
              <Route path="companies" element={<ManageCompanies />} />
              <Route path="terms" element={<ManageTerms />} />
              <Route path="users" element={<ManageUsers />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['company']} />}>
            <Route path="/company-portal" element={<RoleLayout />}>
              <Route index element={<Applicants />} />
              <Route path="positions" element={<CompanyPositions />} />
              <Route path="profile" element={<CompanyProfile />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
