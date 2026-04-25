"use client";

import { useEffect, useState, useMemo } from "react";
import { parseCSV } from "@/lib/csv-parser";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Dot
} from "recharts";
import { AlertTriangle, TrendingDown, TrendingUp, DollarSign, Info } from "lucide-react";

interface ProductInfo {
  ID_PRODOTTO: string;
  CANTINA: string;
  VINO: string;
  PREZZO_BASE: number;
  IMM_URL: string;
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
}

const PriceIntelligence = () => {
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const productsData = await parseCSV<ProductInfo>("/data/database_vini.csv");
        const historyData = await parseCSV<PriceHistory>("/data/storico_prezzi.csv");
        
        // Filter unique products based on ID_PRODOTTO
        const uniqueProductsMap = new Map<string, ProductInfo>();
        productsData.forEach(p => {
          if (!uniqueProductsMap.has(p.ID_PRODOTTO)) {
            uniqueProductsMap.set(p.ID_PRODOTTO, p);
          }
        });
        const uniqueProducts = Array.from(uniqueProductsMap.values());

        setProducts(uniqueProducts);
        setHistory(historyData);
        if (uniqueProducts.length > 0) {
          setSelectedProductId(uniqueProducts[0].ID_PRODOTTO);
        }
      } catch (error) {
        console.error("Error loading CSV data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const productDetails = useMemo(() => 
    products.find(p => p.ID_PRODOTTO === selectedProductId), 
  [products, selectedProductId]);

  const filteredHistory = useMemo(() => 
    history.filter(h => h.ID_PRODOTTO === selectedProductId),
  [history, selectedProductId]);

  // KPI Calculations
  const stats = useMemo(() => {
    if (!productDetails || filteredHistory.length === 0) return null;

    const validPrices = filteredHistory
      .map(h => h.PREZZO_RILEVATO)
      .filter(p => p > 0);
    
    const avgPrice = validPrices.length > 0 
      ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length 
      : 0;
    
    const basePrice = productDetails.PREZZO_BASE;
    const deviance = basePrice > 0 ? (avgPrice / basePrice) - 1 : 0;
    
    const belowBase = filteredHistory.filter(h => h.PREZZO_RILEVATO > 0 && h.PREZZO_RILEVATO < basePrice);
    const percSottocosto = filteredHistory.length > 0 ? (belowBase.length / filteredHistory.length) * 100 : 0;

    return {
      avgPrice,
      basePrice,
      deviance,
      percSottocosto
    };
  }, [productDetails, filteredHistory]);

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const dates = Array.from(new Set(filteredHistory.map(h => h.DATA_ESTRAZIONE.split(' ')[0]))).sort();
    const marketplaces = Array.from(new Set(filteredHistory.map(h => h.SITO_ORIGINE)));

    return dates.map(date => {
      const entry: any = { date };
      marketplaces.forEach(mp => {
        const found = filteredHistory.find(h => h.DATA_ESTRAZIONE.startsWith(date) && h.SITO_ORIGINE === mp);
        if (found) {
          entry[mp] = found.PREZZO_RILEVATO;
          entry[`${mp}_sconto`] = found.PREZZO_SCONTATO;
          entry[`${mp}_stockout`] = found.STOCKOUT === "SI";
          entry[`${mp}_raw`] = found;
        }
      });
      return entry;
    });
  }, [filteredHistory]);

  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe", "#00c49f"];

  if (loading) return <div className="p-8">Caricamento dati...</div>;
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Price Intelligence</h1>
        <select 
          className="p-2 border rounded-md shadow-sm"
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
        >
          {products.map(p => (
            <option key={p.ID_PRODOTTO} value={p.ID_PRODOTTO}>{p.CANTINA} - {p.VINO}</option>
          ))}
        </select>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bento-box flex flex-col items-center justify-center">
          <img 
            src={productDetails?.IMM_URL || "https://placehold.co/100x200?text=Vino"} 
            alt="Bottiglia" 
            className="h-24 object-contain"
          />
        </div>
        
        <div className="bento-box">
          <p className="text-xs font-semibold text-gray-400 uppercase">Prezzo Base (MAP)</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">€ {stats?.basePrice.toFixed(2)}</p>
        </div>

        <div className="bento-box">
          <p className="text-xs font-semibold text-gray-400 uppercase">Prezzo Medio</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">€ {stats?.avgPrice.toFixed(2)}</p>
        </div>

        <div className="bento-box">
          <p className="text-xs font-semibold text-gray-400 uppercase">Devianza %</p>
          <p className={cn(
            "text-2xl font-bold mt-2",
            (stats?.deviance ?? 0) < 0 ? "text-red-600" : "text-green-600"
          )}>
            {((stats?.deviance ?? 0) * 100).toFixed(1)}%
          </p>
        </div>

        <div className="bento-box">
          <p className="text-xs font-semibold text-gray-400 uppercase">% Sottocosto</p>
          <p className="text-2xl font-bold text-red-600 mt-2">{(stats?.percSottocosto ?? 0).toFixed(1)}%</p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white p-6 shadow-sm border rounded-sm h-[450px]">
        <h3 className="text-lg font-bold mb-4">Andamento Prezzi per Marketplace</h3>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const mp = payload[0].name;
                  return (
                    <div className="bg-white p-3 border shadow-md rounded-md">
                      <p className="font-bold border-b mb-2 pb-1">{mp}</p>
                      <p className="text-sm">Prezzo: <span className="font-bold">€ {payload[0].value}</span></p>
                      {data[`${mp}_sconto`] && (
                        <p className="text-sm text-yellow-600 font-medium">Scontato: € {data[`${mp}_sconto`]}</p>
                      )}
                      {data[`${mp}_stockout`] && (
                        <p className="text-sm text-black font-bold">STOCKOUT</p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <ReferenceLine 
              y={stats?.basePrice} 
              stroke="black" 
              strokeWidth={2} 
              strokeDasharray="5 5" 
              label={{ position: 'right', value: 'MAP', fill: 'black', fontSize: 12 }} 
            />
            {Array.from(new Set(filteredHistory.map(h => h.SITO_ORIGINE))).map((mp, index) => (
              <Line
                key={mp}
                type="monotone"
                dataKey={mp}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const price = payload[mp];
                  const isSottocosto = price < (stats?.basePrice ?? 0);
                  const isSconto = payload[`${mp}_sconto`];
                  const isStockout = payload[`${mp}_stockout`];

                  if (isStockout) return <Dot cx={cx} cy={cy} r={6} fill="black" />;
                  if (isSottocosto) return <Dot cx={cx} cy={cy} r={6} fill="red" />;
                  if (isSconto) return (
                    <g>
                      <circle cx={cx} cy={cy} r={8} fill="yellow" opacity={0.4} />
                      <Dot cx={cx} cy={cy} r={4} fill={colors[index % colors.length]} />
                    </g>
                  );
                  return <Dot cx={cx} cy={cy} r={4} fill={colors[index % colors.length]} />;
                }}
                activeDot={{ r: 8 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Wall of Shame */}
      <div className="bg-white shadow-sm border rounded-sm overflow-hidden">
        <div className="bg-gray-50 p-4 border-b">
          <h3 className="font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Wall of Shame (Marketplace Sotto MAP)
          </h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs uppercase text-gray-500 bg-gray-50">
              <th className="px-6 py-3 border-b">Marketplace</th>
              <th className="px-6 py-3 border-b">% Scostamento</th>
              <th className="px-6 py-3 border-b">Delta Medio (€)</th>
              <th className="px-6 py-3 border-b">GG Sconto</th>
              <th className="px-6 py-3 border-b">GG Stockout</th>
            </tr>
          </thead>
          <tbody>
            {/* Logic to aggregate marketplace data */}
            {(() => {
              const mpStats = Array.from(new Set(filteredHistory.map(h => h.SITO_ORIGINE))).map(mp => {
                const mpData = filteredHistory.filter(h => h.SITO_ORIGINE === mp);
                const avgMpPrice = mpData.reduce((a, b) => a + b.PREZZO_RILEVATO, 0) / mpData.length;
                const scostamento = (avgMpPrice / (stats?.basePrice ?? 1)) - 1;
                const delta = avgMpPrice - (stats?.basePrice ?? 0);
                const ggSconto = mpData.filter(h => h.PREZZO_SCONTATO).length;
                const ggStockout = mpData.filter(h => h.STOCKOUT === "SI").length;
                
                return { mp, scostamento, delta, ggSconto, ggStockout };
              })
              .filter(s => s.scostamento < 0)
              .sort((a, b) => a.scostamento - b.scostamento);

              return mpStats.map(s => (
                <tr key={s.mp} className="hover:bg-red-50 transition-colors">
                  <td className="px-6 py-4 border-b font-medium">{s.mp}</td>
                  <td className="px-6 py-4 border-b text-red-600 font-bold">{(s.scostamento * 100).toFixed(1)}%</td>
                  <td className="px-6 py-4 border-b text-red-600 font-bold">€ {s.delta.toFixed(2)}</td>
                  <td className="px-6 py-4 border-b">{s.ggSconto}</td>
                  <td className="px-6 py-4 border-b">{s.ggStockout}</td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

export default PriceIntelligence;
