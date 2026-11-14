import type { ReactNode } from "react";
import { DemoShell } from "@/components/demo/DemoShell";

export default function BuyerLayout({ children }: { children: ReactNode }) {
  return (
    <DemoShell
      current="/buyer"
      account={
        <>
          <span className="bd-strong">Ndlovu Home Stores</span>
          <span className="bd-small bd-muted">Buyer · Demo account</span>
        </>
      }
    >
      {children}
    </DemoShell>
  );
}
