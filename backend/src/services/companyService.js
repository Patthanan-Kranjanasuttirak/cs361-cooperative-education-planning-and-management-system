import * as companyModel from "../models/companyModel.js";
import { HttpError } from "../utils/httpError.js";

// Business logic ของสถานประกอบการ

export async function listCompanies({ search, province }) {
  const data = await companyModel.findAll({
    search: typeof search === "string" ? search.trim() : "",
    province: typeof province === "string" ? province.trim() : "",
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
