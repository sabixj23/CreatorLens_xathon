import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreatorLENS — Make the next cut count",
  description: "Evidence-based feedback for short-form creators.",
};

const nav = [
  { href: "/", label: "Home" },
  { href: "/trends", label: "Trends" },
  { href: "/history", label: "History" },
  { href: "/personalise", label: "Post Analysis" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div className="site-shell">
    <header className="site-header"><Link href="/" className="brand"><span className="brand-mark">◉</span> CreatorLENS</Link><nav aria-label="Main navigation">{nav.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav><span className="header-note">A clearer next cut.</span></header>
    <main>{children}</main>
    <footer>CreatorLENS <span>Made for the moments that matter.</span></footer>
  </div></body></html>;
}
