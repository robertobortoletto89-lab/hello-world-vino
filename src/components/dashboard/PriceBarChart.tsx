"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
// import { useSession } from "next-auth/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Brush,
  ReferenceLine,
  Cell
} from "recharts";
import { cn } from "@/lib/utils";

interface PriceHistory {
  DATA_ESTRAZIONE: string;
  ID_PRODOTTO: string;
  CANTINA: string;
  NOME_PRODOTTO: string;
  SITO_ORIGINE: string;
  PREZZO_RILEVATO: number;
  PREZZO_SCONTATO: number;
  STOCKOUT: string;
  SCREENSHOT_PATH?: string;
  TRIGGER_REASON?: string;
}

interface PriceBarChartProps {
  data: PriceHistory[];
  basePrice: number;
  onVisibleDataChange?: (visibleData: PriceHistory[]) => void;
}

// Cool Pastel Marketplace Palette Colors (no green, yellow, or orange)
const MARKET_COLORS: Record<string, string> = {
  "Tannico": "#93c5fd",     // Azzurro
  "Vino.com": "#c4b5fd",    // Lavanda
  "Callmewine": "#99f6e4",  // Ciano tenue
  "Xtrawine": "#cbd5e1",    // Ardesia
  "Bernabei": "#a5b4fc",    // Indaco chiaro
  "Vivino": "#d8b4fe"       // Lilla
};

const FALLBACK_COLOR = "#e2e8f0"; // Grigio ghiaccio

const getMarketplaceColor = (mp: string): string => {
  return MARKET_COLORS[mp] || FALLBACK_COLOR;
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      SITO_ORIGINE: string;
      STOCKOUT: string;
      PREZZO_RILEVATO: number;
      PREZZO_SCONTATO: number;
    };
  }>;
}

// Bento Grid Aesthetic Tooltip
const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const { SITO_ORIGINE, STOCKOUT, PREZZO_RILEVATO, PREZZO_SCONTATO } = data;

    return (
      <div className="bg-white shadow-xl rounded-xl p-4 border border-gray-100 text-sm max-w-xs space-y-3 font-sans">
        {STOCKOUT === "SI" ? (
          // Rule 1: Stockout
          <div className="space-y-2">
            <div className="font-semibold text-gray-800 tracking-tight">{SITO_ORIGINE}</div>
            <div className="inline-flex items-center gap-1.5 bg-red-950 text-red-200 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
              <span>⚠️</span> STOCKOUT RILEVATO
            </div>
          </div>
        ) : PREZZO_SCONTATO > 0 ? (
          // Rule 2: Promotion - starting price line-through next to discounted price
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold text-gray-800 tracking-tight">{SITO_ORIGINE}</span>
              <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                In Promozione
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-gray-400 line-through text-xs">
                € {PREZZO_RILEVATO.toFixed(2)}
              </span>
              <span className="text-red-600 font-extrabold text-base">
                € {PREZZO_SCONTATO.toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          // Rule 3: Regular
          <div className="space-y-1">
            <div className="font-semibold text-gray-800 tracking-tight">{SITO_ORIGINE}</div>
            <div className="text-gray-600 text-xs">
              Prezzo: <span className="font-bold text-gray-900 text-sm">€ {PREZZO_RILEVATO.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function PriceBarChart({ data, basePrice, onVisibleDataChange }: PriceBarChartProps) {
  // const { data: session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [cantinaVisibile, setCantinaVisibile] = useState<string | null>(null);

  useEffect(() => {
    const cookiesList = document.cookie.split(";").map(c => c.trim());
    const demoCookie = cookiesList.find(c => c.startsWith("kyria_demo_session="));
    if (demoCookie && demoCookie.split("=")[1] === "admin_demo") {
      setIsAdmin(true);
      setCantinaVisibile("ALL");
    }
  }, []);

  // State to filter and hide specific marketplaces from the chart
  const [hiddenMarketplaces, setHiddenMarketplaces] = useState<string[]>([]);

  // 1. Data sanitization & security check (handling NaN and filtering by CANTINA_VISIBILE)
  // Wrapped in useMemo with primitive dependencies to stabilize reference and prevent brush reset
  const cleanData = useMemo(() => {
    let temp = data;

    // Filter using CANTINA_VISIBILE key to isolate records (unless admin or ALL)
    if (!isAdmin && cantinaVisibile && cantinaVisibile !== "ALL") {
      temp = data.filter(item => item.CANTINA === cantinaVisibile);
    }

    return temp
      .map(item => {
        // Optimized clean cast parsing (pre-formatted data already has dot separator)
        const numPrezzoRilevato = Number(item.PREZZO_RILEVATO) || 0;
        const numPrezzoBase = Number(basePrice) || 0;
        const numPrezzoScontato = Number(item.PREZZO_SCONTATO) || 0;

        const isStockout = item.STOCKOUT === "SI";
        // Ghost bar height forced to basePrice, normal bar uses prezzoRilevato
        const displayPrice = isStockout ? numPrezzoBase : numPrezzoRilevato;

        // Truncate extraction date (DD/MM/YYYY -> DD/MM)
        const dateParts = item.DATA_ESTRAZIONE.split("/");
        const truncatedDate = dateParts.length >= 2 ? `${dateParts[0]}/${dateParts[1]}` : item.DATA_ESTRAZIONE;

        return {
          ...item,
          PREZZO_RILEVATO: numPrezzoRilevato,
          PREZZO_BASE: numPrezzoBase,
          PREZZO_SCONTATO: numPrezzoScontato,
          displayPrice,
          date: truncatedDate,
          x: String(item.DATA_ESTRAZIONE || '')
        };
      })
      .sort((a, b) => {
        const [da, ma, ya] = a.DATA_ESTRAZIONE.split("/").map(Number);
        const [db, mb, yb] = b.DATA_ESTRAZIONE.split("/").map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      });
  }, [data, basePrice, isAdmin, cantinaVisibile]);

  // Extract all unique marketplaces from cleanData for the interactive filters
  const allMarketplaces = useMemo(() => {
    return Array.from(new Set(cleanData.map(item => item.SITO_ORIGINE))).sort();
  }, [cleanData]);

  // Filter out marketplaces present in the hiddenMarketplaces array
  const filteredChartData = useMemo(() => {
    return cleanData.filter(item => !hiddenMarketplaces.includes(item.SITO_ORIGINE));
  }, [cleanData, hiddenMarketplaces]);

  // Keep track of Brush visible slice indices
  const [brushIndex, setBrushIndex] = useState<{ start: number; end: number } | null>(null);

  // Reset zoom and filters when dataset changes
  useEffect(() => {
    setBrushIndex(null);
  }, [filteredChartData]);

  // Slice data based on current brush range
  const visibleData = useMemo(() => {
    if (!brushIndex) return filteredChartData;
    const { start, end } = brushIndex;
    return filteredChartData.slice(start, end + 1);
  }, [filteredChartData, brushIndex]);

  // Notify parent on visible slice changes
  useEffect(() => {
    if (onVisibleDataChange) {
      onVisibleDataChange(visibleData);
    }
  }, [visibleData, onVisibleDataChange]);

  const handleBrushChange = useCallback((range: { startIndex?: number; endIndex?: number } | null | undefined) => {
    if (range && typeof range.startIndex === "number" && typeof range.endIndex === "number") {
      setBrushIndex({ start: range.startIndex, end: range.endIndex });
    }
  }, []);

  const toggleMarketplace = useCallback((mp: string) => {
    setHiddenMarketplaces(prev =>
      prev.includes(mp) ? prev.filter(item => item !== mp) : [...prev, mp]
    );
  }, []);

  if (cleanData.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center bg-gray-50 border rounded-md text-gray-400 italic">
        Nessun dato disponibile per questa cantina o per il periodo selezionato.
      </div>
    );
  }

  const numBasePrice = Number(basePrice) || 0;

  return (
    <div className="bg-white p-6 border rounded-sm shadow-sm space-y-4">
      {/* Title and Controls */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-100 pb-3">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          Storico Prezzi Rilevati per Marketplace
        </h3>
        
        <div className="flex items-center gap-3 self-end">
          {brushIndex && (
            <button
              onClick={() => setBrushIndex(null)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-bold transition-all"
            >
              Ripristina Zoom
            </button>
          )}
          {hiddenMarketplaces.length > 0 && (
            <button
              onClick={() => setHiddenMarketplaces([])}
              className="text-xs text-gray-500 hover:text-gray-700 hover:underline font-bold transition-all"
            >
              Mostra Tutti
            </button>
          )}
        </div>
      </div>

      {/* Interactive Marketplace Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-gray-50 p-3 rounded-md border border-gray-100">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mr-1 select-none">
          Escludi Marketplace:
        </span>
        {allMarketplaces.map(mp => {
          const isHidden = hiddenMarketplaces.includes(mp);
          const color = getMarketplaceColor(mp);
          return (
            <button
              key={mp}
              onClick={() => toggleMarketplace(mp)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200 flex items-center gap-1.5 outline-none select-none",
                isHidden
                  ? "bg-gray-100 border-gray-200 text-gray-400 line-through"
                  : "bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
              )}
              style={!isHidden ? { borderLeft: `4px solid ${color}` } : undefined}
            >
              <span>{mp}</span>
              {!isHidden && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              )}
            </button>
          );
        })}
      </div>

      {filteredChartData.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center bg-gray-50 border rounded-md text-gray-400 italic">
          Tutti i marketplace sono stati nascosti. Seleziona almeno un filtro per visualizzare il grafico.
        </div>
      ) : (
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={filteredChartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 10 }}
              />
              <YAxis
                domain={[0, "auto"]}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 10 }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "#f3f4f6", opacity: 0.4 }}
              />
              <Bar
                dataKey="displayPrice"
                onClick={(state) => {
                  if (state && state.payload) {
                    console.log("Apertura Fotomulta per:", state.payload);
                  } else if (state) {
                    console.log("Apertura Fotomulta per:", state);
                  }
                }}
              >
                {filteredChartData.map((entry, index) => {
                  const isStockout = entry.STOCKOUT === "SI";
                  const numPrezzoRilevato = entry.PREZZO_RILEVATO;
                  const numPrezzoBase = entry.PREZZO_BASE;
                  const numPrezzoScontato = entry.PREZZO_SCONTATO;
                  const siteName = entry.SITO_ORIGINE;
                  const siteColor = MARKET_COLORS[siteName] || FALLBACK_COLOR;

                  // CONDITION A: Stockout -> Transparent fill, gray dashed border
                  if (isStockout) {
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill="transparent"
                        stroke="#9ca3af"
                        strokeDasharray="5 5"
                        className="cursor-pointer"
                      />
                    );
                  }

                  // CONDITION B: Dumping (Under MAP price) -> Ruby Red
                  if (numPrezzoRilevato < numPrezzoBase) {
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill="#e11d48"
                        stroke="none"
                        className="cursor-pointer"
                      />
                    );
                  }

                  // CONDITION C: Sconto -> Cool pastel fill with dark indigo border to show discount margin without using yellow
                  if (numPrezzoScontato > 0 && numPrezzoScontato !== numPrezzoRilevato) {
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={siteColor}
                        stroke="#6366f1"
                        strokeWidth={3}
                        className="cursor-pointer"
                      />
                    );
                  }

                  // CONDITION D: Normal Case -> Clean marketplace color
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={siteColor}
                      stroke="none"
                      className="cursor-pointer"
                    />
                  );
                })}
              </Bar>
              
              <Brush
                dataKey="date"
                height={30}
                stroke="#cbd5e1"
                onChange={handleBrushChange}
                startIndex={brushIndex ? brushIndex.start : undefined}
                endIndex={brushIndex ? brushIndex.end : undefined}
              />

              {/* ReferenceLine physical z-index placement (after Bar and Brush) */}
              <ReferenceLine
                y={numBasePrice}
                stroke="#374151"
                strokeDasharray="5 5"
                strokeWidth={3}
                label={{
                  value: `MAP: €${numBasePrice.toFixed(2)}`,
                  fill: "#374151",
                  position: "top",
                  fontSize: 10,
                  fontWeight: 600
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
