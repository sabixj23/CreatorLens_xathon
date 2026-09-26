import type { Metadata } from "next";
import { PlanReport } from "@/components/plan-report";
export const metadata: Metadata = { title: "Your 12-week plan · CreatorLENS" };
export default function PlanPage() { return <PlanReport />; }
