"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Download, RotateCcw } from "lucide-react";

// Importazione dinamica di Plotly per evitare errori SSR
const Plot = dynamic(() => import("react-plotly.js"), { 
  ssr: false,
  loading: () => <div className="h-[400px] flex items-center justify-center bg-gray-50 text-gray-400">Caricamento Grafico...</div>
});

interface ChartProps {
  data: any[];
  basePrice: number;
  marketplaces: string[];
  onVisibleDataChange?: (visibleData: any[], visibleMarketplaces: string[]) => void;
  xDomain: [string, string] | null;
  onZoom: (domain: [string, string] | null) => void;
}

const PASTEL_COLORS = [
  "#FFB3BA", "#BAFFC9", "#BAE1FF", "#FFFFBA", "#FFDFBA", "#E0BBE4",
  "#D4F0F0", "#FFC8A2", "#F9EBDF", "#D5AAFF", "#85E3FF", "#B2F2BB"
];

const isWeekend = (dateStr: string) => {
  const parts = dateStr.split(' ');
  if (parts.length < 2) return false;
  const [day, month] = parts[1].split('/').map(Number);
  const year = new Date().getFullYear();
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
};

const Chart = ({ data, basePrice, marketplaces, onVisibleDataChange, xDomain, onZoom }: ChartProps) => {
  console.log('Dati ricevuti nel grafico:', data);
  console.log('Prezzo base:', basePrice);

  const [visibleMarketplaces, setVisibleMarketplaces] = useState<string[]>(marketplaces);
  const [currentRange, setCurrentRange] = useState<[string, string] | null>(xDomain);

  // Sincronizza il range locale con la prop xDomain
  useEffect(() => {
    setCurrentRange(xDomain);
  }, [xDomain]);

  // Gestione del filtraggio dati per il componente padre
  const handleRelayout = useCallback((event: any) => {
    let newRange: [string, string] | null = null;
    
    // Plotly relayout can have different property names for ranges
    if (event['xaxis.range[0]'] && event['xaxis.range[1]']) {
      newRange = [event['xaxis.range[0]'], event['xaxis.range[1]']];
    } else if (event['xaxis.autorange']) {
      newRange = null;
    } else if (event['xaxis.range']) {
      newRange = [event['xaxis.range'][0], event['xaxis.range'][1]];
    }

    if (JSON.stringify(newRange) !== JSON.stringify(currentRange)) {
      setCurrentRange(newRange);
      if (onZoom) onZoom(newRange);
    }
  }, [currentRange, onZoom]);

  const handleLegendClick = useCallback((event: any) => {
    const mp = event.data[event.curveNumber].name;
    if (mp === 'PREZZO BASE') return false; 

    setVisibleMarketplaces(prev => {
      const isVisible = prev.includes(mp);
      if (isVisible) {
        return prev.filter(m => m !== mp);
      } else {
        return [...prev, mp];
      }
    });
    
    return false; // Impedisce a Plotly di gestire la visibilità internamente
  }, []);

  // Update parent when visible data changes (triggered by currentRange, visibleMarketplaces or data)
  useEffect(() => {
    if (onVisibleDataChange && data.length > 0) {
      let visibleData = data;
      
      if (currentRange) {
        try {
          const start = new Date(currentRange[0]).getTime();
          const end = new Date(currentRange[1]).getTime();
          
          if (!isNaN(start) && !isNaN(end)) {
            visibleData = data.filter(d => {
              const [day, month, year] = d.rawDate.split('/').map(Number);
              const timestamp = new Date(year, month - 1, day).getTime();
              return timestamp >= start && timestamp <= end;
            });
          }
        } catch (e) {
          console.error("Errore nel calcolo del range visibile:", e);
        }
      }
      
      onVisibleDataChange(visibleData, visibleMarketplaces);
    }
  }, [currentRange, visibleMarketplaces, data, onVisibleDataChange]);

  // Generazione Traces per Plotly
  const traces = useMemo(() => {
    const marketplaceTraces = marketplaces.map((mp, index) => {
      const x = data.map(d => {
        // Usa rawDate (formato DD/MM/YYYY) per creare un oggetto Date preciso
        const [day, month, year] = d.rawDate.split('/').map(Number);
        return new Date(year, month - 1, day);
      });
      const y = data.map(d => d[mp]);

      // Configurazione marker dinamici
      const markerSymbols = data.map(d => {
        const price = d[mp];
        if (d[`${mp}_stockout`]) return 'circle';
        if (price < basePrice) return 'diamond';
        return 'circle';
      });

      const markerColors = data.map(d => {
        const price = d[mp];
        if (d[`${mp}_stockout`]) return 'black';
        if (price < basePrice) return 'red';
        return PASTEL_COLORS[index % PASTEL_COLORS.length];
      });

      const markerLineColors = data.map(d => {
        if (d[`${mp}_sconto`]) return 'yellow';
        return 'transparent';
      });

      const markerLineWidths = data.map(d => {
        if (d[`${mp}_sconto`]) return 4;
        return 0;
      });

      const hoverText = data.map(d => {
        const price = d[mp];
        if (price === undefined || price === null || isNaN(price)) return null;
        return `<b>${mp}</b><br>Prezzo: €${price.toFixed(2)}<br>SCONTO: ${d[`${mp}_sconto`] ? 'SI' : 'NO'}<br>STOCKOUT: ${d[`${mp}_stockout`] ? 'SI' : 'NO'}`;
      });

      return {
        x,
        y,
        name: mp,
        type: 'scatter',
        mode: 'lines+markers',
        line: { 
          color: PASTEL_COLORS[index % PASTEL_COLORS.length],
          width: 3
        },
        marker: {
          symbol: markerSymbols,
          color: markerColors,
          size: 10,
          line: {
            color: markerLineColors,
            width: markerLineWidths
          }
        },
        hoverinfo: 'text',
        text: hoverText,
        visible: visibleMarketplaces.includes(mp) ? true : 'legendonly'
      };
    });

    // Trace per il PREZZO BASE (MAP)
    const basePriceTrace = {
      x: data.map(d => {
        const [day, month] = d.date.split(' ')[1].split('/').map(Number);
        return new Date(new Date().getFullYear(), month - 1, day);
      }),
      y: data.map(() => basePrice),
      name: 'PREZZO BASE',
      type: 'scatter',
      mode: 'lines',
      line: {
        color: 'black',
        width: 3,
        dash: 'dash'
      },
      hoverinfo: 'skip'
    };

    return [...marketplaceTraces, basePriceTrace];
  }, [data, marketplaces, visibleMarketplaces, basePrice]);

  // Calcolo Scala Asse Y Dinamica
  const yAxisRange = useMemo(() => {
    const allPrices: number[] = [];
    data.forEach(row => {
      marketplaces.forEach(mp => {
        const val = row[mp];
        if (typeof val === 'number' && isFinite(val)) {
          allPrices.push(val);
        }
      });
    });

    const actualMin = allPrices.length > 0 ? Math.min(...allPrices) : basePrice;
    const actualMax = allPrices.length > 0 ? Math.max(...allPrices) : basePrice;

    const safeMin = basePrice - 10;
    const safeMax = basePrice + 10;

    return [
      Math.max(0, Math.min(actualMin, safeMin) - 5),
      Math.max(actualMax, safeMax) + 5
    ];
  }, [data, marketplaces, basePrice]);

  const handleDownloadCSV = () => {
    if (data.length === 0) return;
    const headers = ["Data", ...marketplaces];
    const csvRows = [
      headers.join(";"),
      ...data.map(row => [row.date, ...marketplaces.map(mp => row[mp] || "")].join(";"))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `export_prezzi_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="bg-white p-6 shadow-sm border rounded-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold">Andamento Prezzi per Marketplace</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              if (onZoom) onZoom(null);
              setVisibleMarketplaces(marketplaces);
            }} 
            className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-blue-600 border px-2 py-1 rounded"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Grafico
          </button>
          <button onClick={handleDownloadCSV} className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-green-600 border px-2 py-1 rounded">
            <Download className="h-3.5 w-3.5" /> Scarica CSV
          </button>
        </div>
      </div>

      <div className="h-[500px] w-full">
        {/* @ts-ignore */}
        <Plot
          data={traces as any}
          layout={{
            autosize: true,
            height: 500,
            margin: { l: 50, r: 30, t: 20, b: 80 },
            hovermode: 'closest',
            dragmode: 'zoom',
            xaxis: {
              type: 'date',
              tickformat: '%b %d/%m',
              rangeslider: { 
                visible: true,
                borderwidth: 1,
                bordercolor: '#cbd5e1',
                bgcolor: '#f8fafc'
              },
              tickfont: {
                size: 10,
                color: 'black' 
              },
              range: currentRange ? [new Date(currentRange[0]), new Date(currentRange[1])] : undefined
            },
            yaxis: {
              range: yAxisRange,
              tickprefix: '€',
              gridcolor: '#f0f0f0',
              zeroline: false
            },
            showlegend: true,
            legend: {
              orientation: 'h',
              y: -0.5,
              x: 0.5,
              xanchor: 'center'
            },
            plot_bgcolor: 'white',
            paper_bgcolor: 'white'
          }}
          config={{
            displayModeBar: true,
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['select2d', 'lasso2d']
          }}
          onRelayout={handleRelayout}
          onLegendClick={handleLegendClick}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

export default Chart;
