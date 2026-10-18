import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import CompanyForm from '../../components/CompanyForm';
import ApiState from '../../components/ApiState';
import '../CSS/myApplications.css';
export default function CompanyProfile() {
  const { data, reload, loading, error } = useApi('/company/profile', null);
  const [notice, setNotice] = useState('');
  const save = async (body) => { await api('/company/profile', { method: 'PUT', body }); await reload(); setNotice('บันทึกข้อมูลบริษัทแล้ว'); };
  return <section><h1 className="app-title">ข้อมูลบริษัท</h1><ApiState loading={loading} error={error} />{notice && <p role="status">{notice}</p>}{data && <CompanyForm key={data.company_id} initial={data} onSave={save} />}</section>;
}
