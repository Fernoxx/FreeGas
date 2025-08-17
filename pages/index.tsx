import { useState } from "react";
import { base } from "wagmi/chains";
import { createWalletClient, createPublicClient, custom, getContract, parseAbi, Hex } from "viem";

const CONTRACT = (process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`) || "0x4e07df426c1912af30b24595b1aa474118a0efc6";
const ABI = parseAbi([
  "function claim(uint256 amount,uint256 nonce,uint256 deadline,bytes32 twitterHash,bytes signature) external",
  "function claimedAddress(address) view returns (bool)",
]);

function pickAllowedProvider(): any | null {
  const w = window as any;
  const providers = (w.ethereum?.providers as any[]) || [];
  const okx = w.okxwallet?.ethereum || providers.find((p:any)=>p.isOKExWallet) || (w.ethereum?.isOKExWallet ? w.ethereum : null);
  if (okx) return okx;
  const metamask = providers.find((p:any)=>p.isMetaMask) || (w.ethereum?.isMetaMask ? w.ethereum : null);
  if (metamask) return metamask;
  const rabby = providers.find((p:any)=>p.isRabby) || (w.ethereum?.isRabby ? w.ethereum : null) || w.rabby;
  if (rabby) return rabby;
  return null;
}

async function ensureBase(provider:any) {
  try {
    const cidHex = await provider.request({ method: "eth_chainId" });
    if (parseInt(cidHex, 16) !== base.id) {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] });
    }
  } catch (e:any) {
    if (e?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x2105",
          chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org"],
          blockExplorerUrls: ["https://basescan.org"],
        }],
      });
    } else { throw e; }
  }
}

export default function Page() {
  const [note, setNote] = useState("");

  async function onClick() {
    setNote("");
    try {
      const provider = pickAllowedProvider();
      if (!provider) { setNote("Open in OKX, MetaMask, or Rabby"); return; }

      await provider.request({ method: "eth_requestAccounts" });
      await ensureBase(provider);

      const wallet = createWalletClient({ chain: base, transport: custom(provider) });
      const pub    = createPublicClient({ chain: base, transport: custom(provider) });
      const addr   = (await wallet.getAddresses())[0];

      const hasTwitter = document.cookie.split(";").some(c => c.trim().startsWith("tw_hash="));
      if (!hasTwitter) { window.location.href = "/api/x/start"; return; }

      const r = await fetch("/api/claim-sig?wallet=" + addr, { credentials: "include" });
      const payload = await r.json();
      if (payload.error) { setNote(payload.error); return; }

      const view = getContract({ address: CONTRACT as Hex, abi: ABI, client: pub });
      const already = await view.read.claimedAddress([addr]);
      if (already) { setNote("Already claimed with this wallet"); return; }

      const write = getContract({ address: CONTRACT as Hex, abi: ABI, client: wallet });
      setNote("Sending claim… confirm in wallet");
      const tx = await write.write.claim(
        [
          BigInt(payload.amount),
          BigInt(payload.nonce),
          BigInt(payload.deadline),
          payload.twitterHash as `0x${string}`,
          payload.signature as `0x${string}`,
        ],
        { account: addr }
      );
      setNote("Sent. Tx " + tx);
    } catch (e:any) {
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
      position: "relative"
    }}>
      <button onClick={onClick} style={{
        background: "#5B21B6",
        color: "#fff",
        padding: "18px 28px",
        borderRadius: 16,
        border: "none",
        fontSize: 20,
        cursor: "pointer",
        boxShadow: "0 6px 18px rgba(0,0,0,0.15)"
      }}>Free Gas</button>

      <div style={{ position: "fixed", bottom: 20, width: "100%", textAlign: "center", color: "#4B5563" }}>
        {note}
      </div>
    </div>
  );
}