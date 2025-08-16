import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [base],
  connectors: [
    injected({ shimDisconnect: true }),
  ],
  transports: { [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC || "https://base-mainnet.g.alchemy.com/v2/imwS2Zh4ezDWuQm1A1mFO") },
});