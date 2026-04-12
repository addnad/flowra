const { ethers } = require("ethers");

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const AGENT_ID = 1492;
const NEW_WALLET = "0x82576190669b9795bFDB82cA6DdfCaF9125FAA3f";
const RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;

const ABI = [
  "function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external",
  "function getAgentWallet(uint256 agentId) external view returns (address)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const ownerWallet = new ethers.Wallet(process.env.OWNER_KEY, provider);
  const signerWallet = new ethers.Wallet(process.env.SIGNER_KEY, provider);
  const registry = new ethers.Contract(IDENTITY_REGISTRY, ABI, ownerWallet);

  console.log("Owner:", ownerWallet.address);
  console.log("New wallet:", signerWallet.address);
  console.log("Current agent wallet:", await registry.getAgentWallet(AGENT_ID));

  const deadline = Math.floor(Date.now() / 1000) + 30;
  const domain = { name: "IdentityRegistry", version: "1", chainId: CHAIN_ID, verifyingContract: IDENTITY_REGISTRY };
  const types = { SetAgentWallet: [{ name: "agentId", type: "uint256" }, { name: "newWallet", type: "address" }, { name: "deadline", type: "uint256" }] };
  const value = { agentId: AGENT_ID, newWallet: NEW_WALLET, deadline };

  console.log("Signing EIP-712 message...");
  const signature = await signerWallet.signTypedData(domain, types, value);

  console.log("Calling setAgentWallet...");
  const tx = await registry.setAgentWallet(AGENT_ID, NEW_WALLET, deadline, signature);
  console.log("TX hash:", tx.hash);
  await tx.wait();
  console.log("Done. New agent wallet:", await registry.getAgentWallet(AGENT_ID));
}

main().catch(console.error);
