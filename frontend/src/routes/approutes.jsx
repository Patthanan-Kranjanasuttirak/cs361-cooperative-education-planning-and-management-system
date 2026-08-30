import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from '../pages/home';
import Company from '../pages/company';
import Studenthandbook from '../pages/StudentHandbook';

export default function approutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/detail/:id" element={<Home />} />
        <Route path="/company" element={<Company />} />
        <Route path="/student-handbook" element={<Studenthandbook />} />
      </Routes>
    </BrowserRouter>
  );
}