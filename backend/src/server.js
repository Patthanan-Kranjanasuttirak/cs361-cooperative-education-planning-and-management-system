import app from "./app.js";

// รัน API ในเครื่อง (Docker / npm run dev)
const port = process.env.PORT || 5000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend listening on port ${port}`);
});
