"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { INDEX_DEFS, type IndexDef } from "@/lib/market-index";
import MarketIndexCard from "./MarketIndexCard";

// Modal pulls in lightweight-charts; load it client-only and only when opened.
const IndexDetailModal = dynamic(() => import("./IndexDetailModal"), { ssr: false });

// YieldLab-style market index section: replaces the old RSI cards.
// Desktop 3-col / tablet 2-col / mobile 1-col responsive grid.
export default function MarketIndexSection() {
  const [active, setActive] = useState<{ def: IndexDef; range: string } | null>(null);

  return (
    <section className="mb-6 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INDEX_DEFS.map((def) => (
          <MarketIndexCard key={def.symbol} def={def} onOpen={(d, range) => setActive({ def: d, range })} />
        ))}
      </div>

      {active && (
        <IndexDetailModal def={active.def} initialRange={active.range} onClose={() => setActive(null)} />
      )}
    </section>
  );
}
