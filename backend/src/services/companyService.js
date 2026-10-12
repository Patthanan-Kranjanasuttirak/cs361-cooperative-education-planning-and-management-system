import * as companyModel from "../models/companyModel.js";
import { HttpError } from "../utils/httpError.js";

// Business logic ของสถานประกอบการ

const APPLICATION_STATUSES = ["open", "upcoming", "closed"];

// query parameter ต้องเป็นข้อความ (ถ้าส่งมาซ้ำหลายค่า เช่น ?province=a&province=b จะถือว่าไม่ได้กรอง)
const asText = (value) => (typeof value === "string" ? value.trim() : "");

export async function listCompanies({ search, province, position, status }) {
  const statusText = asText(status);
  if (statusText && !APPLICATION_STATUSES.includes(statusText)) {
    throw new HttpError(400, `Invalid status (use ${APPLICATION_STATUSES.join(", ")})`);
  }

  const data = await companyModel.findAll({
    search: asText(search),
    province: asText(province),
    position: asText(position),
    status: statusText,
  });
  return { data, total: data.length };
}

export async function getCompany(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, "Invalid company id");
  }

  const company = await companyModel.findById(id);
  if (!company) {
    throw new HttpError(404, "Company not found");
  }
  return company;
}
