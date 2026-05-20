"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, Camera, X } from "lucide-react";
import Chart from "./Chart";

interface ProductInfo {
  ID_PRODOTTO: string;
  CANTINA: string;
  NOME_PRODOTTO: string;
  PREZZO_BASE: number;
  URL_IMMAGINE: string;
}

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

const PriceIntelligence = () => {
  const searchParams = useSearchParams();
  const selectedProductId = searchParams.get("id_prodotto") || "";
  const dataInizio = searchParams.get("data_inizio");
  const dataFine = searchParams.get("data_fine");

  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States for Zoom
  const [zoomXDomain, setZoomXDomain] = useState<[string, string] | null>(null);

  // States for Modal Audit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<PriceHistory | null>(null);

  // Reactive stats based on visible chart data
  const [visibleStats, setVisibleStats] = useState({
    avgPrice: 0,
    basePrice: 0,
    deviance: 0,
    percSottocosto: 0
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const prodResponse = await fetch('/api/prodotti');
        const productsData = await prodResponse.json();
        const historyResponse = await fetch('/api/storico');
        const historyData = await historyResponse.json();
        setProducts(productsData);
        setHistory(historyData);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const productDetails = useMemo(() => 
    products.find(p => p.ID_PRODOTTO === selectedProductId), 
  [products, selectedProductId]);

  const filteredHistory = useMemo(() => {
    let filtered = history.filter(h => h.ID_PRODOTTO === selectedProductId);
    if (dataInizio) {
      const start = new Date(dataInizio);
      filtered = filtered.filter(h => {
        const [d, m, y] = h.DATA_ESTRAZIONE.split('/');
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)) >= start;
      });
    }
    if (dataFine) {
      const end = new Date(dataFine);
      filtered = filtered.filter(h => {
        const [d, m, y] = h.DATA_ESTRAZIONE.split('/');
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)) <= end;
      });
    }
    return filtered;
  }, [history, selectedProductId, dataInizio, dataFine]);

  const chartData = useMemo(() => {
    const months: Record<string, string> = {
      '01': 'gen', '02': 'feb', '03': 'mar', '04': 'apr', '05': 'mag', '06': 'giu',
      '07': 'lug', '08': 'ago', '09': 'set', '10': 'ott', '11': 'nov', '12': 'dic'
    };
    const uniqueDateStrings = Array.from(new Set(filteredHistory.map(h => h.DATA_ESTRAZIONE)));
    const sortedDateStrings = uniqueDateStrings.sort((a, b) => {
      const [da, ma, ya] = a.split('/').map(Number);
      const [db, mb, yb] = b.split('/').map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });
    const marketplaces = Array.from(new Set(filteredHistory.map(h => h.SITO_ORIGINE)));
    return sortedDateStrings.map(dateStr => {
      const [d, m] = dateStr.split('/');
      const formattedDate = `${months[m]} ${d}/${m}`;
      const entry: any = { date: formattedDate, rawDate: dateStr };
      marketplaces.forEach(mp => {
        const found = filteredHistory.find(h => h.DATA_ESTRAZIONE === dateStr && h.SITO_ORIGINE === mp);
        if (found) {
          entry[mp] = found.PREZZO_RILEVATO;
          entry[`${mp}_sconto`] = found.PREZZO_SCONTATO > 0;
          entry[`${mp}_stockout`] = found.STOCKOUT === "SI";
        }
      });
      return entry;
    });
  }, [filteredHistory]);

  const marketplaces = useMemo(() => 
    Array.from(new Set(filteredHistory.map(h => h.SITO_ORIGINE))),
  [filteredHistory]);

  useEffect(() => {
    if (productDetails) {
      setVisibleStats(prev => ({
        ...prev,
        basePrice: productDetails.PREZZO_BASE
      }));
    }
  }, [productDetails]);

  const handleVisibleDataChange = useCallback((visibleData: any[], visibleMarketplaces: string[]) => {
    if (!productDetails) return;

    // Fallback: se lo zoom non cattura dati, usa i dati totali del prodotto corrente
    const dataToProcess = (visibleData && visibleData.length > 0) ? visibleData : chartData;

    const basePrice = productDetails.PREZZO_BASE;
    const allPrices: number[] = [];
    let belowBaseCount = 0;
    let totalRilevazioni = 0;

    dataToProcess.forEach(row => {
      visibleMarketplaces.forEach(mp => {
        const price = row[mp];
        if (typeof price === 'number' && price > 0) {
          allPrices.push(price);
          totalRilevazioni++;
          if (price < basePrice) belowBaseCount++;
        }
      });
    });

    const avgPrice = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0;
    const deviance = basePrice > 0 ? (avgPrice / basePrice) - 1 : 0;
    const percSottocosto = totalRilevazioni > 0 ? (belowBaseCount / totalRilevazioni) * 100 : 0;

    setVisibleStats({
      avgPrice,
      basePrice,
      deviance,
      percSottocosto
    });
  }, [productDetails, chartData]);

  const handleZoom = useCallback((domain: [string, string] | null) => {
    setZoomXDomain(domain);
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Caricamento Price Intelligence...</div>;
  if (!productDetails) return (
    <div className="p-12 text-center bg-gray-50 border border-dashed rounded-md">
      <Info className="h-12 w-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900">Nessun prodotto selezionato</h3>
      <p className="text-gray-500 mt-1">Usa la barra di ricerca in alto per selezionare un vino da analizzare.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="bg-white p-2 border rounded-md shadow-sm">
            <img 
              src={productDetails.URL_IMMAGINE || "https://placehold.co/100x200?text=Vino"} 
              alt={productDetails.NOME_PRODOTTO} 
              className="h-32 w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{productDetails.NOME_PRODOTTO}</h1>
            <p className="text-gray-500">{productDetails.CANTINA}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bento-box bg-white p-4 border rounded-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase">Prezzo Base (MAP)</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">€ {(visibleStats.basePrice ?? 0).toFixed(2)}</p>
        </div>
        <div className="bento-box bg-white p-4 border rounded-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase">Prezzo Medio</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">€ {(visibleStats.avgPrice ?? 0).toFixed(2)}</p>
        </div>
        <div className="bento-box bg-white p-4 border rounded-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase">Devianza Media</p>
          <p className={cn(
            "text-2xl font-bold mt-2",
            (visibleStats.deviance ?? 0) < 0 ? "text-red-600" : "text-green-600"
          )}>
            {((visibleStats.deviance ?? 0) * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      <Chart 
        data={chartData} 
        basePrice={productDetails.PREZZO_BASE} 
        marketplaces={marketplaces} 
        onVisibleDataChange={handleVisibleDataChange}
        xDomain={zoomXDomain}
        onZoom={handleZoom}
      />

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/4">
          <div className="bento-box bg-white p-8 border rounded-sm h-full flex flex-col items-center justify-center text-center">
            <p className="text-sm font-bold text-gray-400 uppercase mb-4">% SOTTOCOSTO</p>
            <div className="relative">
              <p className="text-5xl font-black text-red-600">{(visibleStats.percSottocosto ?? 0).toFixed(1)}%</p>
              <div className="absolute -top-2 -right-6">
                <AlertTriangle className="h-8 w-8 text-red-600 animate-pulse" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4 max-w-[150px]">Percentuale di rilevazioni con prezzo inferiore al MAP nel periodo visibile</p>
          </div>
        </div>

        <div className="lg:w-3/4">
          <div className="bg-white shadow-sm border rounded-sm overflow-hidden h-full">
            <div className="bg-red-50 p-4 border-b border-red-100">
              <h3 className="font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Wall of Shame (Marketplace Sotto MAP)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase text-gray-500 bg-gray-50">
                    <th className="px-6 py-3 border-b">Marketplace</th>
                    <th className="px-6 py-3 border-b">% Scostamento</th>
                    <th className="px-6 py-3 border-b">Delta Medio (€)</th>
                    <th className="px-6 py-3 border-b">GG Sconto</th>
                    <th className="px-6 py-3 border-b">GG Stockout</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {(() => {
                    const mpStats = marketplaces.map(mp => {
                      const mpData = filteredHistory.filter(h => h.SITO_ORIGINE === mp);
                      const avgMpPrice = mpData.reduce((a, b) => a + b.PREZZO_RILEVATO, 0) / mpData.length;
                      const scostamento = (avgMpPrice / (productDetails.PREZZO_BASE ?? 1)) - 1;
                      const delta = avgMpPrice - (productDetails.PREZZO_BASE ?? 0);
                      const ggSconto = mpData.filter(h => h.PREZZO_SCONTATO > 0).length;
                      const ggStockout = mpData.filter(h => h.STOCKOUT === "SI").length;
                      return { mp, scostamento, delta, ggSconto, ggStockout };
                    })
                    .filter(s => s.scostamento < -0.01)
                    .sort((a, b) => a.scostamento - b.scostamento);

                    if (mpStats.length === 0) return <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">Nessun marketplace attualmente sotto il prezzo base.</td></tr>;

                    return mpStats.map(s => (
                      <tr key={s.mp} className="hover:bg-red-50 transition-colors">
                        <td className="px-6 py-4 border-b font-medium">{s.mp}</td>
                        <td className="px-6 py-4 border-b text-red-600 font-bold">{(s.scostamento * 100).toFixed(1)}%</td>
                        <td className="px-6 py-4 border-b text-red-600 font-bold">€ {(s.delta ?? 0).toFixed(2)}</td>
                        <td className="px-6 py-4 border-b">{s.ggSconto}</td>
                        <td className="px-6 py-4 border-b font-bold">{s.ggStockout}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Sezione Audit Trail / Dettaglio Rilevazioni */}
      <div className="bg-white shadow-sm border rounded-sm overflow-hidden">
        <div className="bg-gray-50 p-4 border-b">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <Camera className="h-5 w-5" /> Audit Trail - Dettaglio Rilevazioni
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase text-gray-500 bg-gray-50">
                <th className="px-6 py-3 border-b">Data</th>
                <th className="px-6 py-3 border-b">Marketplace</th>
                <th className="px-6 py-3 border-b">Prezzo Rilevato</th>
                <th className="px-6 py-3 border-b">Motivo / Audit</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredHistory.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">Nessuna rilevazione trovata per il periodo selezionato.</td></tr>
              ) : (
                [...filteredHistory].sort((a, b) => {
                  const [da, ma, ya] = a.DATA_ESTRAZIONE.split('/').map(Number);
                  const [db, mb, yb] = b.DATA_ESTRAZIONE.split('/').map(Number);
                  return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
                }).map((h, i) => (
                  <tr 
                    key={i} 
                    className={cn(
                      "hover:bg-gray-50 transition-colors",
                      h.SCREENSHOT_PATH ? "cursor-pointer" : ""
                    )}
                    onClick={() => {
                      if (h.SCREENSHOT_PATH) {
                        setSelectedAudit(h);
                        setIsModalOpen(true);
                      }
                    }}
                  >
                    <td className="px-6 py-4 border-b text-gray-600">{h.DATA_ESTRAZIONE}</td>
                    <td className="px-6 py-4 border-b font-medium">{h.SITO_ORIGINE}</td>
                    <td className="px-6 py-4 border-b font-bold">
                      € {h.PREZZO_RILEVATO.toFixed(2)}
                      {h.SCREENSHOT_PATH && (
                        <Camera size={16} className="inline-block ml-2 text-red-500" />
                      )}
                    </td>
                    <td className="px-6 py-4 border-b">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        h.TRIGGER_REASON === 'SOTTO_PREZZO' ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      )}>
                        {h.TRIGGER_REASON || 'REGOLARE'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Audit Trail */}
      {isModalOpen && selectedAudit && (
        <div 
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl max-w-4xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-6 border-b bg-gray-50">
              <div className="flex gap-6">
                <div className="bg-white p-3 rounded-md border shadow-sm flex items-center justify-center">
                  <Camera className="h-8 w-8 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-gray-900">Audit Trail Fotografico</h3>
                  <div className="flex gap-4 mt-2">
                    <div className="bg-red-100 px-2 py-1 rounded text-[10px] font-bold text-red-700 uppercase border border-red-200">
                      {selectedAudit.TRIGGER_REASON || 'SOTTO_PREZZO'}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <span className="font-semibold text-gray-700">€ {selectedAudit.PREZZO_RILEVATO.toFixed(2)}</span> su {selectedAudit.SITO_ORIGINE}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      il {selectedAudit.DATA_ESTRAZIONE}
                    </div>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 bg-gray-100">
              <div className="relative bg-white rounded-md overflow-hidden border shadow-inner p-2">
                <img 
                  src={selectedAudit.SCREENSHOT_PATH} 
                  alt="Audit Trail" 
                  className="w-full max-h-[70vh] object-contain mx-auto rounded-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/800x600?text=Screenshot+Non+Disponibile";
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceIntelligence;
