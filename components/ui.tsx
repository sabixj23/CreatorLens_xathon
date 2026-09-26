import type { ReactNode } from "react";
import Link from "next/link";
import { CONNECT_HREF } from "@/lib/api";

export function Icon({ name, size = 20 }: { name: "arrow" | "grid" | "diagnosis" | "dna" | "paths" | "chart" | "bulb" | "lock" | "check" | "youtube"; size?: number }) {
  const paths = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    diagnosis: <><path d="M7 3h10l3 3v15H4V3h3ZM8 8h8M8 12h8M8 16h5" /></>,
    dna: <><path d="M6 3c0 8 12 10 12 18M18 3c0 8-12 10-12 18M7 6h10M8 10h8M8 14h8M7 18h10" /></>,
    paths: <><path d="M12 21V10M12 14l-7-7M12 14l7-7M2 7h4V3M18 3v4h4M9 5l3-3 3 3" /></>,
    chart: <><path d="M4 3v17h17M7 15l4-5 4 2 5-7" /></>,
    bulb: <><path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0l-1 2H9l-1-2Z" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    youtube: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3Z" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function Brand() {
  return <Link href="/" className="brand" aria-label="CreatorLENS home"><span className="brand-symbol" aria-hidden="true"><i /></span><span>Creator<span className="brand-light">LENS</span></span></Link>;
}
export function ConnectLink({ children = "Connect YouTube", secondary = false }: { children?: ReactNode; secondary?: boolean }) {
  return <a className={`button ${secondary ? "button-secondary" : "button-primary"}`} href={CONNECT_HREF}><Icon name="youtube" size={18} />{children}<Icon name="arrow" size={17} /></a>;
}
export function MockLabel({ note, label = "Demo channel" }: { note?: string; label?: string }) {
  return <span className="mock-label" title={note}><span aria-hidden="true" />{label}</span>;
}
export function SectionHeading({ number, eyebrow, title, children }: { number?: string; eyebrow?: string; title: string; children?: ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{number && <span>{number} / </span>}{eyebrow}</p>}<h2>{title}</h2></div>{children && <div className="section-aside">{children}</div>}</div>;
}
