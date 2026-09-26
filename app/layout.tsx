import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreatorLENS — See why your channel stalled",
  description: "The analytical half of a growth strategist, for creators who've plateaued.",
};

const nav = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
];

// Minimal shell — the frontend track owns the real dark navy/beige design system,
// the anchor-nav sidebar, and the full page layouts. This is just enough structure
// for the backend routes to be exercised end to end.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <header className="site-header">
            <Link href="/" className="brand">
              CreatorLENS
            </Link>
            <nav aria-label="Main navigation">
              {nav.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          <main>{children}</main>
          <footer>CreatorLENS</footer>
        </div>
      </body>
    </html>
  );
}
