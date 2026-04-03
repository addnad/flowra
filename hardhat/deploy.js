import { ethers } from "ethers";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import solc from "solc";
import dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BACKEND_SIGNER = process.env.BACKEND_SIGNER;

const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

console.log("Deploying from:", wallet.address);

const balance = await provider.getBalance(wallet.address);
console.log("Balance:", ethers.formatUnits(balance, 6), "USDC");

console.log("Compiling...");

const source = readFileSync("contracts/DriplyStreams.sol", "utf8");

function findImports(path) {
  try {
    return { contents: readFileSync(`node_modules/${path}`, "utf8") };
  } catch {
    return { error: "File not found" };
  }
}

const input = {
  language: "Solidity",
  sources: { "DriplyStreams.sol": { content: source } },
  settings: {
    viaIR: true,
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
  const errors = output.errors.filter(e => e.severity === "error");
  if (errors.length > 0) {
    console.error("Compilation errors:", errors.map(e => e.message).join("\n"));
    process.exit(1);
  }
  output.errors.filter(e => e.severity === "warning").forEach(w => console.warn("Warning:", w.message));
}

const contract = output.contracts["DriplyStreams.sol"]["DriplyStreams"];
const abi = contract.abi;
const bytecode = contract.evm.bytecode.object;

mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/DriplyStreams.abi", JSON.stringify(abi));
writeFileSync("artifacts/DriplyStreams.bin", bytecode);

console.log("Compilation successful!");

const factory = new ethers.ContractFactory(abi, bytecode, wallet);

console.log("Deploying contract...");
const deployed = await factory.deploy(BACKEND_SIGNER);
await deployed.waitForDeployment();

const address = await deployed.getAddress();
console.log("✅ DriplyStreams deployed at:", address);
