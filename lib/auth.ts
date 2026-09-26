import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";

const YOUTUBE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number; // seconds since epoch
    error?: "RefreshAccessTokenError";
  }
}

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshAccessTokenError";
  }
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) return { ...token, error: "RefreshAccessTokenError" };
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });
    const refreshed = await response.json();
    if (!response.ok) throw refreshed;
    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      // Auth.js v5 auto-reads AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET by convention, not
      // GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET — pass them explicitly to keep the env
      // var names the rest of this project (and the shared spec) already uses.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: YOUTUBE_SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // Initial sign-in: account carries the tokens Google just issued.
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }
      if (token.expiresAt && Date.now() < token.expiresAt * 1000) {
        return token; // still valid
      }
      // Expired — Auth.js v5 does not do this automatically, so it happens here.
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
});
