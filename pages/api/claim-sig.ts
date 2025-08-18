import type { NextApiRequest, NextApiResponse } from "next";
import { privateKeyToAccount } from "viem/accounts";
import { Hex } from "viem";

const signer = privateKeyToAccount(process.env.SIGNER_PK as `0x${string}`);
const issued = new Set<string>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const wallet = (req.query.wallet as string)?.toLowerCase();
    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet))
      return res.status(400).json({ error: "bad wallet" });

    const cookies = Object.fromEntries(
      (req.headers.cookie || "").split(";").map((s) => s.trim().split("="))
    );
    const twHash = cookies["tw_hash"];
    if (!twHash) return res.status(401).json({ error: "twitter not linked" });
    if (issued.has(twHash)) return res.status(429).json({ error: "twitter already used" });

    const amount = 22_727_272_727_272n;
    const nonce = BigInt(Date.now());
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);

    const domain = {
      name: "FreeGasClaimTwitterGate",
      version: "1",
      chainId: 8453,
      verifyingContract: process.env.CONTRACT as `0x${string}`,
    };
    const types = {
      Claim: [
        { name: "wallet", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "twitterHash", type: "bytes32" },
      ],
    } as const;
    const message = {
      wallet: wallet as `0x${string}`,
      amount,
      nonce,
      deadline,
      twitterHash: twHash as Hex,
    } as const;

    const signature = await signer.signTypedData({
      domain,
      types,
      primaryType: "Claim",
      message,
    });

    issued.add(twHash);
    res.json({
      amount: amount.toString(),
      nonce: nonce.toString(),
      deadline: Number(deadline),
      twitterHash: twHash,
      signature,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "server error" });
  }
}
