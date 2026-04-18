import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, metaMask } from "wagmi/connectors";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Network Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const FLOWRA_CONTRACT_ADDRESS = "0x93E4c5F06CE3ae006d7FbFce13f82Ab76AA7A064" as `0x${string}`;
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;
export const USDC_DECIMALS = 6;
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export const config = createConfig({
  chains: [arcTestnet],
  connectors: [
    injected(),
    metaMask(),
  ],
  transports: {
    [arcTestnet.id]: http(),
  },
});
