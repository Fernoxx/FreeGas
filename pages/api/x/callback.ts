import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

async function exchangeToken(code: string, verifier: string) {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: process.env.X_CLIENT_ID!,
    redirect_uri: `${process.env.BASE_URL}/api/x/callback`,
    code_verifier: verifier,
  });

  const r = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${process.env.X_CLIENT_ID!}:${process.env.X_CLIENT_SECRET!}`).toString(
          "base64"
        ),
    },
    body,
  });
  if (!r.ok) throw new Error("token exchange failed");
  return r.json() as Promise<{ access_token: string }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { code, state } = req.query as { code: string; state: string };
    const cookies = Object.fromEntries(
      (req.headers.cookie || "").split(";").map((s) => s.trim().split("="))
    );

    if (!cookies.tw_state || state !== cookies.tw_state) throw new Error("bad state");

    const tok = await exchangeToken(code, cookies.tw_verifier);
    const me = (await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    }).then((r) => r.json())) as any;

    const twitterId = me?.data?.id as string;
    if (!twitterId) throw new Error("no twitter id");

    const twHash =
      "0x" +
      crypto.createHash("sha256").update(`${twitterId}:${process.env.TW_SALT!}`).digest("hex");

    res.setHeader("Set-Cookie", [
      `tw_hash=${twHash}; HttpOnly; Path=/; SameSite=Lax`,
      "tw_state=; Path=/; Max-Age=0",
      "tw_verifier=; Path=/; Max-Age=0",
    ]);

    res.redirect("/");
  } catch (e: any) {
    res.status(400).send(e.message || "error");
  }
}
