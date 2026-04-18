const { initiateDeveloperControlledWalletsClient } = require("@circle-fin/developer-controlled-wallets");
const { v4: uuidv4 } = require("uuid");

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

let walletSetId = null;

async function getOrCreateWalletSet() {
  if (walletSetId) return walletSetId;
  const response = await client.createWalletSet({ name: "Flowra Wallet Set" });
  walletSetId = response.data?.walletSet?.id;
  return walletSetId;
}

async function createWallet(userId) {
  const setId = await getOrCreateWalletSet();
  const response = await client.createWallets({
    blockchains: ["ARC-TESTNET"],
    count: 1,
    walletSetId: setId,
    metadata: [{ name: userId, refId: userId }],
  });
  return response.data?.wallets?.[0];
}

async function getWalletBalance(walletId) {
  const response = await client.getWalletTokenBalance({ id: walletId });
  return response.data?.tokenBalances || [];
}

async function getOrCreateWallet(userId, redisGet, redisSet) {
  const key = "wallet:" + userId.toLowerCase();
  const existing = await redisGet(key);
  if (existing) return existing;
  const wallet = await createWallet(userId);
  await redisSet(key, wallet);
  return wallet;
}

module.exports = { createWallet, getWalletBalance, getOrCreateWallet, client };
