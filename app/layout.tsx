import type { Metadata } from "next";
import { Brand } from "@/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreatorLENS — A clearer next move",
  description: "Understand why your YouTube Shorts growth stalled, explore three 12-week Shorts strategies, and turn your history into a considered next move.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><header className="site-header"><Brand /><span className="header-note">THE CREATOR’S STRATEGY DESK</span></header><main id="main-content">{children}</main></body></html>;
}
