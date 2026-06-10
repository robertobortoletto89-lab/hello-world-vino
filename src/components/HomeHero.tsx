"use client";

import React, { useState } from "react";
import { Sparkles, AlertTriangle, TrendingDown, MessageSquareWarning } from "lucide-react";

interface HomeHeroProps {
  isAdmin: boolean;
  cantinaDisplay: string;
  nomeUtente: string;
}

export default function HomeHero({ isAdmin, cantinaDisplay, nomeUtente }: HomeHeroProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    // Dispatch event to open Kyria Chat and send the query
    window.dispatchEvent(
      new CustomEvent("trigger-kyria-prompt", {
        detail: { message: query.trim() }
      })
    );
    setQuery("");
  };

  const handlePillClick = (pillType: "anomalie" | "dumping" | "sentiment") => {
    // Dispatch event to open Kyria Chat and trigger the pill action
    window.dispatchEvent(
      new CustomEvent("trigger-kyria-prompt", {
        detail: { pillType }
      })
    );
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 md:p-12 text-center flex flex-col items-center justify-center space-y-6 relative overflow-hidden transition-all hover:shadow-md">
      {/* Subtle decorative background gradients */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-60"></div>
      
      <div className="inline-flex items-center justify-center space-x-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-wider">
        <Sparkles className="h-3.5 w-3.5" />
        <span>AI Command Center</span>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
          Benvenuto. Cosa vogliamo analizzare oggi?
        </h1>
        <p className="text-sm text-gray-500 max-w-lg mx-auto">
          {isAdmin 
            ? `Pannello di controllo globale per l'amministratore (${cantinaDisplay})`
            : `Dashboard per ${nomeUtente} (${cantinaDisplay})`}
        </p>
      </div>

      {/* Unlocked Search Bar */}
      <form onSubmit={handleSubmit} className="relative w-full max-w-2xl mt-2 group">
        <input 
          type="text" 
          placeholder="Chiedi a KYRIA un'analisi o seleziona un'azione rapida..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-5 pr-12 py-4 bg-gray-50 border border-gray-200 focus:border-blue-400 focus:bg-white rounded-xl text-gray-800 placeholder-gray-400 text-sm focus:outline-none shadow-sm transition-all"
        />
        <button 
          type="submit" 
          className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center text-blue-500 hover:text-blue-600 transition-colors"
        >
          <Sparkles className="h-5 w-5 animate-pulse" />
        </button>
      </form>

      {/* Action Pills */}
      <div className="w-full flex flex-col items-center space-y-3 mt-4">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Azioni Rapide</span>
        <div className="flex flex-wrap gap-3 justify-center items-center">
          <button 
            onClick={() => handlePillClick("anomalie")}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
            <span>Scansione Anomalie (Ultimi 7gg)</span>
          </button>
          <button 
            onClick={() => handlePillClick("dumping")}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <TrendingDown className="h-4.5 w-4.5 text-rose-500" />
            <span>Top 3 Peggiori Dumping</span>
          </button>
          <button 
            onClick={() => handlePillClick("sentiment")}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <MessageSquareWarning className="h-4.5 w-4.5 text-orange-500" />
            <span>Allarmi Sentiment Negativo</span>
          </button>
        </div>
      </div>
    </section>
  );
}
