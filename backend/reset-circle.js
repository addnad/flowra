require("dotenv").config();
const { generateEntitySecretCiphertext } = require("@circle-fin/developer-controlled-wallets");
const fs = require("fs");
const https = require("https");

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const newEntitySecret = "3255635d45240553880f0372e7fb68f164352b31693c8f14bda10ed86e6fa070";
  const recoveryFile = fs.readFileSync("/Users/mac/circle-setup/recovery/recovery_file_1771862097470.dat", "utf8").trim();

  console.log("Generating new ciphertext...");
  const ciphertext = await generateEntitySecretCiphertext({ apiKey, entitySecret: newEntitySecret });
  console.log("Ciphertext generated");

  const body = JSON.stringify({
    entitySecretCiphertext: ciphertext,
    recoveryFile: recoveryFile,
  });

  const options = {
    hostname: "api.circle.com",
    path: "/v1/w3s/config/entity/entitySecret/reset",
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  const result = await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  console.log("Status:", result.status);
  console.log("Response:", result.body);

  if (result.status === 200) {
    const parsed = JSON.parse(result.body);
    const newRecovery = parsed.data?.recoveryFile;
    if (newRecovery) fs.writeFileSync("circle-recovery-new.dat", newRecovery);
    const envContent = fs.readFileSync(".env", "utf8");
    const updated = envContent.replace(/CIRCLE_ENTITY_SECRET=.*/, `CIRCLE_ENTITY_SECRET=${newEntitySecret}`);
    fs.writeFileSync(".env", updated);
    console.log("Done! Entity secret reset successfully.");
  }
}

main().catch(e => console.error("FAIL:", e.message));
