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

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (process.env.X_CLIENT_SECRET) {
    headers["Authorization"] =
      "Basic " +
      Buffer.from(`${process.env.X_CLIENT_ID!}:${process.env.X_CLIENT_SECRET!}`).toString(
        "base64"
      );
  }

  const r = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers,
    body,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`token exchange failed: ${text}`);
  }
  return r.json() as Promise<{ access_token: string; id_token?: string }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const code = (req.query.code as string) || (req.body?.code as string);
    const state = (req.query.state as string) || (req.body?.state as string);
    if (!code || !state) throw new Error("missing code or state");
    const cookies = Object.fromEntries(
      (req.headers.cookie || "").split(";").map((s) => s.trim().split("="))
    );

    if (!cookies.tw_state || state !== cookies.tw_state) throw new Error("bad state");
    if (!cookies.tw_verifier) throw new Error("missing verifier cookie");

    const tok = await exchangeToken(code, cookies.tw_verifier);
    let twitterId: string | undefined;
    if (tok.id_token) {
      const [, payloadB64] = tok.id_token.split(".");
      try {
        const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
        twitterId = payload.sub as string | undefined;
      } catch {}
    }
    if (!twitterId) {
      const meRes = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      const me = (await meRes.json()) as any;
      twitterId = me?.data?.id as string | undefined;
      if (!twitterId) throw new Error(`no twitter id: ${JSON.stringify(me)}`);
    }

    const twHash =
      "0x" +
      crypto.createHash("sha256").update(`${twitterId}:${process.env.TW_SALT!}`).digest("hex");

    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie", [
      `tw_hash=${twHash}; HttpOnly; Path=/; SameSite=Lax${secure}`,
      `tw_state=; Path=/; Max-Age=0${secure}`,
      `tw_verifier=; Path=/; Max-Age=0${secure}`,
    ]);

    res.redirect("/");
  } catch (e: any) {
    res.status(400).send(e.message || "error");
  }
}
