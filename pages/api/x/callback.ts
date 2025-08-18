import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import OAuth from "oauth-1.0a";

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
    const cookies = Object.fromEntries((req.headers.cookie || "").split(";").map((s) => s.trim().split("=")));
    // OAuth 1.0a branch
    if (req.query.oauth_token && req.query.oauth_verifier && cookies.tw_req_token) {
      const consumerKey = process.env.X_CONSUMER_KEY || process.env.X_CLIENT_ID!;
      const consumerSecret = process.env.X_CONSUMER_SECRET || process.env.X_CLIENT_SECRET!;
      const oauth = new OAuth({
        consumer: { key: consumerKey, secret: consumerSecret },
        signature_method: "HMAC-SHA1",
        hash_function(base, key) { return crypto.createHmac("sha1", key).update(base).digest("base64"); },
      });
      const accessUrl = "https://api.twitter.com/oauth/access_token";
      const data: any = { oauth_token: req.query.oauth_token as string, oauth_verifier: req.query.oauth_verifier as string };
      const auth = oauth.toHeader(oauth.authorize({ url: accessUrl, method: "POST", data }));
      const r = await fetch(accessUrl, {
        method: "POST",
        headers: { Authorization: auth.Authorization, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(data),
      });
      const text = await r.text();
      if (!r.ok) return res.status(400).send(text || "access_token failed");
      const params = Object.fromEntries(text.split("&").map((kv) => { const [k, v] = kv.split("="); return [k, decodeURIComponent(v || "")]; }));
      const twitterId = params.user_id as string | undefined;
      if (!twitterId) throw new Error("no twitter id from oauth1");

      const twHash = "0x" + crypto.createHash("sha256").update(`${twitterId}:${process.env.TW_SALT!}`).digest("hex");
      const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
      res.setHeader("Set-Cookie", [
        `tw_hash=${twHash}; HttpOnly; Path=/; SameSite=Lax${secure}`,
        `tw_req_token=; Path=/; Max-Age=0${secure}`,
        `tw_req_secret=; Path=/; Max-Age=0${secure}`,
      ]);
      res.redirect("/");
      return;
    }

    // OAuth 2.0 branch
    const code = (req.query.code as string) || (req.body?.code as string);
    const state = (req.query.state as string) || (req.body?.state as string);
    if (!code || !state) throw new Error("missing code or state");
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
