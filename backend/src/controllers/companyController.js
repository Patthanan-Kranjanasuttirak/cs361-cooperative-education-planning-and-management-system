import * as companyService from "../services/companyService.js";

// รับ Request แล้วส่ง Response (error จะถูกส่งต่อไปที่ errorHandler อัตโนมัติใน Express 5)

// GET /api/companies?search=&province=&position=&status=
export async function listCompanies(req, res) {
  const { search, province, position, status } = req.query;
  const result = await companyService.listCompanies({ search, province, position, status });
  res.json(result);
}

// GET /api/companies/:id
export async function getCompany(req, res) {
  const company = await companyService.getCompany(req.params.id);
  res.json(company);
}
