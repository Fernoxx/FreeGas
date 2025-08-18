import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import OAuth from "oauth-1.0a";

function getConsumer() {
  const key = process.env.X_CONSUMER_KEY || process.env.X_CLIENT_ID;
  const secret = process.env.X_CONSUMER_SECRET || process.env.X_CLIENT_SECRET;
  if (!key || !secret) throw new Error("missing twitter consumer/client keys");
  return { key, secret } as const;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const useOAuth1 = req.query.v === "1" || process.env.X_FORCE_OAUTH1 === "true";
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  if (useOAuth1) {
    const consumer = getConsumer();
    const oauth = new OAuth({
      consumer: { key: consumer.key, secret: consumer.secret },
      signature_method: "HMAC-SHA1",
      hash_function(base, key) {
        return crypto.createHmac("sha1", key).update(base).digest("base64");
      },
    });
    const callbackUrl = `${process.env.BASE_URL}/api/x/callback`;
    const url = "https://api.twitter.com/oauth/request_token";
    const data = { oauth_callback: callbackUrl } as any;
    const auth = oauth.toHeader(oauth.authorize({ url, method: "POST", data }));
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: auth.Authorization, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data),
    });
    const text = await r.text();
    if (!r.ok) return res.status(400).send(text || "request_token failed");
    const params = Object.fromEntries(text.split("&").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, decodeURIComponent(v || "")];
    }));
    if (params.oauth_callback_confirmed !== "true") return res.status(400).send("callback not confirmed");

    res.setHeader("Set-Cookie", [
      `tw_req_token=${params.oauth_token}; HttpOnly; Path=/; SameSite=Lax${secure}`,
      `tw_req_secret=${params.oauth_token_secret}; HttpOnly; Path=/; SameSite=Lax${secure}`,
    ]);
    res.redirect(`https://api.twitter.com/oauth/authenticate?oauth_token=${params.oauth_token}`);
    return;
  }

  // OAuth 2.0 PKCE (kept for projects with paid access)
  const state = crypto.randomBytes(16).toString("hex");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  res.setHeader("Set-Cookie", [
    `tw_state=${state}; HttpOnly; Path=/; SameSite=Lax${secure}`,
    `tw_verifier=${verifier}; HttpOnly; Path=/; SameSite=Lax${secure}`,
  ]);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_CLIENT_ID!,
    redirect_uri: `${process.env.BASE_URL}/api/x/callback`,
    scope: "openid users.read offline.access",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  res.redirect(`https://twitter.com/i/oauth2/authorize?${params.toString()}`);
}
