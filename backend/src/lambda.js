import serverless from "serverless-http";
import app from "./app.js";
import { migrate } from "./migrate.js";

const api = serverless(app);
export const handler = async (event, context) =>
  event.action === "migrate" ? migrate() : api(event, context);