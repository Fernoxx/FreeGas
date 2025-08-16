import { useState } from "react";
import { base } from "wagmi/chains";
import { createWalletClient, createPublicClient, custom, getContract, parseAbi, Hex } from "viem";

const CONTRACT = "0x5e879d7303ed2b6c02f297d324da54897101e7d7" as const;
const ABI = parseAbi([
  "function claim() external",
  "function claimed(address) view returns (bool)",
]);

function pickAllowedProvider(): any | null {
  const w = window as any;
  const providers = (w.ethereum?.providers as any[]) || [];

  const okx = w.okxwallet?.ethereum || providers.find((p: any) => p.isOKExWallet) || (w.ethereum?.isOKExWallet ? w.ethereum : null);
  if (okx) return okx;

  const metamask = providers.find((p: any) => p.isMetaMask) || (w.ethereum?.isMetaMask ? w.ethereum : null);
  if (metamask) return metamask;

  const rabby = providers.find((p: any) => p.isRabby) || (w.ethereum?.isRabby ? w.ethereum : null) || (w.rabby ? w.rabby : null);
  if (rabby) return rabby;

  return null;
}

export default function Page() {
  const [note, setNote] = useState("");

  async function ensureBase(provider: any) {
    try {
      const chainIdHex = await provider.request({ method: "eth_chainId" });
      if (parseInt(chainIdHex, 16) !== base.id) {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      }
    } catch (e: any) {
      if (e?.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x2105",
            chainName: "Base",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [process.env.NEXT_PUBLIC_BASE_RPC || "https://base-mainnet.g.alchemy.com/v2/imwS2Zh4ezDWuQm1A1mFO"],
            blockExplorerUrls: ["https://basescan.org"],
          }],
        });
      } else {
        throw e;
      }
    }
  }

  async function onClick() {
    setNote("");
    try {
      const provider = pickAllowedProvider();
      if (!provider) {
        setNote("Open in OKX Wallet or MetaMask or Rabby");
        return;
      }

      await provider.request({ method: "eth_requestAccounts" });

      await ensureBase(provider);

      const wallet = createWalletClient({ chain: base, transport: custom(provider) });
      const pub = createPublicClient({ chain: base, transport: custom(provider) });

      const account = (await wallet.getAddresses())[0];

      const contractView = getContract({ address: CONTRACT as Hex, abi: ABI, client: pub });
      const already = await contractView.read.claimed([account]);
      if (already) {
        setNote("Already claimed");
        return;
      }

      const contractWrite = getContract({ address: CONTRACT as Hex, abi: ABI, client: wallet });
      setNote("Sending claim. Confirm in wallet");
      const hash = await contractWrite.write.claim({ account });
      setNote("Sent. Wait for confirm. Tx " + hash);
    } catch (e: any) {
      setNote(e?.message || "Error");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F3E8FF",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, system-ui, Arial",
    }}>
      <button
        onClick={onClick}
        style={{
          background: "#5B21B6",
          color: "white",
          padding: "18px 28px",
          borderRadius: 16,
          border: "none",
          fontSize: 20,
          cursor: "pointer",
          boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
        }}
      >
        Free Gas
      </button>
      <div style={{ position: "fixed", bottom: 20, width: "100%", textAlign: "center", color: "#4B5563" }}>
        {note}
      </div>
    </div>
  );
}