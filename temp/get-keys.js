const jwt = require("jsonwebtoken");

const secret = "0a3f1bde6b48c92b5f8d9a6c7f2134e9b7f8a2c9d4b3c1e6a7d8f9b0c1d2e3f4";

// ANON KEY
const anonKey = jwt.sign({ role: "anon" }, secret, { expiresIn: "10y" });
console.log("ANON_KEY=", anonKey);

// SERVICE ROLE KEY
const serviceKey = jwt.sign({ role: "service_role" }, secret, { expiresIn: "10y" });
console.log("SERVICE_ROLE_KEY=", serviceKey);