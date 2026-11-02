import { Suspense } from "react";
import { PipelineView } from "@/components/pipeline/pipeline-view";

export const metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Pipeline</h1>
          <p>
            Everything you saved or applied to, from shortlist to offer, with follow-ups when they are due.
          </p>
        </div>
      </header>
      <Suspense>
        <PipelineView />
      </Suspense>
    </div>
  );
}
