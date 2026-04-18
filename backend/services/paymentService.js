const { v4: uuidv4 } = require("uuid");
const { client } = require("./walletService");

async function getDepositAddress(walletId) {
  const response = await client.getWallet({ id: walletId });
  const wallet = response.data?.wallet;
  if (!wallet) throw new Error("Wallet not found");
  return { address: wallet.address, blockchain: wallet.blockchain, walletId };
}

async function getDepositStatus(transactionId) {
  const response = await client.getTransaction({ id: transactionId });
  return response.data?.transaction;
}

async function withdraw(walletId, toAddress, amount) {
  const tokenResponse = await client.listTokens({ blockchain: "ARC-TESTNET" });
  const usdcToken = tokenResponse.data?.tokens?.find(t => t.symbol === "USDC");
  if (!usdcToken) throw new Error("USDC token not found on ARC-TESTNET");

  const response = await client.createTransaction({
    walletId,
    tokenId: usdcToken.id,
    destinationAddress: toAddress,
    amounts: [amount.toString()],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    idempotencyKey: uuidv4(),
  });
  return response.data?.transaction;
}

module.exports = { getDepositAddress, getDepositStatus, withdraw };
