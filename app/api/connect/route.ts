import { signIn } from "@/lib/auth";

// Backend-owned redirect so the frontend's Connect button can be a plain <a>, with no
// next-auth import and no detour through Auth.js's unstyled default sign-in page.
// If a bare GET on /api/auth/signin/google turns out to redirect straight into Google's
// consent screen on this next-auth version, this route becomes unnecessary — but it does
// no harm to keep either way.
export async function GET() {
  return signIn("google", { redirectTo: "/dashboard" });
}
