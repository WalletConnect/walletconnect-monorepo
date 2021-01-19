require("dotenv/config");
const { execSync } = require("child_process");

execSync("npx pod-install", { stdio: "inherit" });
