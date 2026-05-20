"use client";

import { Suspense } from "react";
import SentimentAnalysis from "@/components/SentimentAnalysis";

export default function SentimentAnalysisPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Suspense fallback={<div>Caricamento...</div>}>
        <SentimentAnalysis />
      </Suspense>
    </div>
  );
}
