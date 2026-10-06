import { Router } from "express";
import * as companyController from "../controllers/companyController.js";

// เส้นทางของ /api/companies
const router = Router();

router.get("/", companyController.listCompanies);
router.get("/:id", companyController.getCompany);

export default router;
