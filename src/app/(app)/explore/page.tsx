import Link from "next/link";
import { Suspense } from "react";
import { OffersView } from "@/components/offers/offers-view";

export const metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Explore</h1>
          <p>
            Roles outside design where your skills still count: real estate, sales, partnerships, marketing,
            product, consulting and teaching. Each one says how big a pivot it is. Want to know what a field
            is really like? <Link href="/grow">Ask in Grow</Link>.
          </p>
        </div>
        <div id="page-actions" />
      </header>
      <Suspense>
        <OffersView screen="explore" />
      </Suspense>
    </div>
  );
}
