import { Suspense } from "react";
import { OffersView } from "@/components/offers/offers-view";

export const metadata = { title: "Matches" };

export default function MatchesPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Matches</h1>
          <p>
            Creative, design and AI roles in Poland, the EU and beyond, scored against your CV. Includes roles
            that take you beyond day-to-day Figma work.
          </p>
        </div>
        <div id="page-actions" />
      </header>
      <Suspense>
        <OffersView screen="matches" />
      </Suspense>
    </div>
  );
}
