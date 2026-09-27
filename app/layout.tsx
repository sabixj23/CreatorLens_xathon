import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreatorLENS — A clearer next move",
  description: "Understand why your YouTube Shorts growth stalled, explore three 12-week Shorts strategies, and turn your history into a considered next move.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><header className="site-header"><Brand /><span className="header-note">THE CREATOR’S STRATEGY DESK</span><nav aria-label="Main navigation"><Link href="/#approach">The approach</Link><Link href="/dashboard?demo=1" className="header-demo">Explore demo <span aria-hidden="true">↗</span></Link></nav></header><main id="main-content">{children}</main></body></html>;
}
