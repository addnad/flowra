const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.arc.network";
const BACKEND_SIGNER_PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const sponsorWallet = new ethers.Wallet(BACKEND_SIGNER_PRIVATE_KEY, provider);

// Minimum native balance to keep in sponsor wallet
const MIN_SPONSOR_BALANCE = ethers.parseEther("0.01");

async function getSponsorBalance() {
  const balance = await provider.getBalance(sponsorWallet.address);
  return { balance: ethers.formatEther(balance), address: sponsorWallet.address };
}

async function estimateGas(tx) {
  try {
    const estimate = await provider.estimateGas(tx);
    return estimate;
  } catch (e) {
    console.error("Gas estimation failed:", e);
    return 300000n;
  }
}

async function sponsorTransaction(to, data, value = "0") {
  try {
    const sponsorBalance = await provider.getBalance(sponsorWallet.address);
    if (sponsorBalance < MIN_SPONSOR_BALANCE) {
      throw new Error("Sponsor wallet balance too low to cover gas");
    }

    const feeData = await provider.getFeeData();
    const nonce = await provider.getTransactionCount(sponsorWallet.address);

    const tx = {
      to,
      data,
      value: ethers.parseEther(value),
      gasPrice: feeData.gasPrice,
      nonce,
    };

    const gasLimit = await estimateGas({ ...tx, from: sponsorWallet.address });
    tx.gasLimit = gasLimit + (gasLimit / 10n); // add 10% buffer

    const sentTx = await sponsorWallet.sendTransaction(tx);
    console.log(`Paymaster sponsored tx: ${sentTx.hash}`);
    const receipt = await sentTx.wait();
    return { success: true, txHash: sentTx.hash, gasUsed: receipt.gasUsed.toString() };
  } catch (e) {
    console.error("Sponsor transaction failed:", e);
    throw e;
  }
}

async function signGaslessPermit(userAddress, contractAddress, deadline) {
  const messageHash = ethers.solidityPackedKeccak256(
    ["address", "address", "uint256"],
    [userAddress, contractAddress, deadline]
  );
  const signature = await sponsorWallet.signMessage(ethers.getBytes(messageHash));
  return { signature, deadline, sponsorAddress: sponsorWallet.address };
}

module.exports = { getSponsorBalance, sponsorTransaction, signGaslessPermit, estimateGas };
