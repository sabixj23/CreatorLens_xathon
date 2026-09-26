import { Suspense } from "react";
import { ReportProvider } from "@/components/report-provider";
import { StagedLoader, Workspace } from "@/components/workspace";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="standalone-loading"><StagedLoader /></div>}><ReportProvider><Workspace>{children}</Workspace></ReportProvider></Suspense>;
}
