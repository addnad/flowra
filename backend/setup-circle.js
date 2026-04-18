require("dotenv").config();
const { registerEntitySecretCiphertext } = require("@circle-fin/developer-controlled-wallets");
const fs = require("fs");

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = "3255635d45240553880f0372e7fb68f164352b31693c8f14bda10ed86e6fa070";

  console.log("Registering Entity Secret with Circle...");
  const response = await registerEntitySecretCiphertext({ apiKey, entitySecret });

  const recoveryFile = response.data?.recoveryFile;
  if (recoveryFile) {
    fs.writeFileSync("circle-recovery.dat", recoveryFile);
    console.log("Recovery file saved to: circle-recovery.dat");
  }

  const envContent = fs.readFileSync(".env", "utf8");
  const updated = envContent.replace(
    /CIRCLE_ENTITY_SECRET=.*/,
    `CIRCLE_ENTITY_SECRET=${entitySecret}`
  );
  fs.writeFileSync(".env", updated);
  console.log("CIRCLE_ENTITY_SECRET written to .env");
  console.log("Done!");
}

main().catch(console.error);
