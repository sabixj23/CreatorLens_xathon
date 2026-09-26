import type { Metadata } from "next";
import { DashboardReport } from "@/components/dashboard-report";
export const metadata: Metadata = { title: "Channel overview · CreatorLENS" };
export default function DashboardPage() { return <DashboardReport />; }
