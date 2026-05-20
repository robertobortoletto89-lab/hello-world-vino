"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell as BarCell
} from "recharts";
import { Star, X, Info, Filter, AlertCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Review {
  DATA_COMMENTO: string;
  ID_PRODOTTO: string;
  NOME_PRODOTTO: string;
  SITO_ORIGINE: string;
  RATING_ORIGINALE: number;
  TESTO_COMMENTO: string;
  SENTIMENT_SCORE: string;
  PAROLE_CHIAVE_ESTRATTE: string;
}

interface ProductInfo {
  ID_PRODOTTO: string;
  CANTINA: string;
  VINO: string;
}

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text x={x} y={y} fill="black" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2 p-8 bg-gray-50 border border-dashed rounded-md">
    <AlertCircle className="h-10 w-10 opacity-20" />
    <p className="text-sm italic text-center font-medium">{message}</p>
  </div>
);

const CustomWordCloud = ({ 
  words, 
  onWordClick, 
  selectedWord, 
  colorType = "blue" 
}: { 
  words: {text: string, value: number}[], 
  onWordClick: (w: string) => void, 
  selectedWord: string | null,
  colorType?: "green" | "red" | "blue"
}) => {
  if (!words || words.length === 0) return <EmptyState message="Nessuna parola chiave disponibile" />;

  const maxFreq = Math.max(...words.map(w => Number(w.value) || 0), 1);

  const getColorClasses = (isSelected: boolean, intensity: number) => {
    if (isSelected) return "bg-blue-600 text-white font-bold scale-110 shadow-md ring-2 ring-blue-300";
    
    if (colorType === "green") {
      if (intensity > 0.8) return "text-green-800 font-extrabold";
      if (intensity > 0.5) return "text-green-600 font-bold";
      return "text-green-500 opacity-80 font-medium";
    }
    if (colorType === "red") {
      if (intensity > 0.8) return "text-red-800 font-extrabold";
      if (intensity > 0.5) return "text-red-600 font-bold";
      return "text-red-500 opacity-80 font-medium";
    }
    return "text-blue-900";
  };

  return (
    // 1. & 3. FIX DECAPITAZIONE: pt-28 massiccio per spingere le parole in basso e pt-32 per la negativa
    <div className={cn(
      "flex flex-wrap gap-x-4 gap-y-2 justify-center items-center p-4 overflow-y-auto h-full content-center relative",
      colorType === "red" ? "pt-32" : "pt-28"
    )}>
      <style jsx>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
      {words.map((word, i) => {
        const val = Number(word.value) || 0;
        const intensity = val / maxFreq;
        const fontSizeValue = Math.max(12, Math.min(32, 12 + intensity * 20)) || 14;
        const opacityValue = Math.max(0.6, Math.min(1, 0.4 + intensity)) || 1;
        const animationDelay = `${(i * 0.2) % 3}s`;

        return (
          <span
            key={`${word.text}-${i}`}
            onClick={() => onWordClick(word.text)}
            className={cn(
              "cursor-pointer transition-all duration-300 hover:scale-125 hover:z-10 px-2 py-1 rounded-lg text-center inline-block animate-float",
              getColorClasses(selectedWord === word.text, intensity)
            )}
            style={{ 
              fontSize: `${fontSizeValue}px`,
              opacity: selectedWord === word.text ? 1 : opacityValue,
              animationDelay: animationDelay,
              margin: '1px',
              // 4. SICUREZZA LINE-HEIGHT: lineHeight 1.4 per evitare tagli verticali
              lineHeight: '1.4'
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

const SentimentAnalysis = () => {
  const searchParams = useSearchParams();
  const selectedProductId = searchParams.get("id_prodotto") || "";

  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  
  const [selectedSentiment, setSelectedSentiment] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedProductId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/sentiment?id_prodotto=${selectedProductId}`);
        if (!response.ok) {
          throw new Error(`Errore HTTP: ${response.status}`);
        }
        const data = await response.json();
        
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        
        const uniqueProductsMap = new Map<string, ProductInfo>();
        (data.products || []).forEach((p: ProductInfo) => {
          if (!uniqueProductsMap.has(p.ID_PRODOTTO)) {
            uniqueProductsMap.set(p.ID_PRODOTTO, p);
          }
        });
        setProducts(Array.from(uniqueProductsMap.values()));
      } catch (err: unknown) {
        console.error("Error loading sentiment data:", err);
        setError(err instanceof Error ? err.message : "Impossibile caricare i dati");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedProductId]);

  const productDetails = useMemo(() => 
    products.find(p => p.ID_PRODOTTO === selectedProductId), 
  [products, selectedProductId]);

  const filteredData = useMemo(() => {
    if (!Array.isArray(reviews)) return [];
    let filtered = [...reviews];
    
    if (selectedSentiment) {
      filtered = filtered.filter(r => r.SENTIMENT_SCORE === selectedSentiment);
    }
    
    if (selectedWord) {
      const lowerWord = selectedWord.toLowerCase();
      filtered = filtered.filter(r => 
        (r.TESTO_COMMENTO || "").toLowerCase().includes(lowerWord) ||
        (r.PAROLE_CHIAVE_ESTRATTE || "").toLowerCase().includes(lowerWord)
      );
    }
    
    if (selectedSource) {
      filtered = filtered.filter(r => r.SITO_ORIGINE === selectedSource);
    }
    
    return filtered;
  }, [reviews, selectedSentiment, selectedWord, selectedSource]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const avgRating = filteredData.reduce((a, b) => a + Number(b.RATING_ORIGINALE || 0), 0) / filteredData.length;
    const positiveCount = filteredData.filter(r => r.SENTIMENT_SCORE === "Positivo").length;
    return {
      avgRating,
      sentimentScore: (positiveCount / filteredData.length) * 100,
      total: filteredData.length
    };
  }, [filteredData]);

  const pieData = useMemo(() => {
    if (filteredData.length === 0) return [];
    const counts = {
      Positivo: filteredData.filter(r => r.SENTIMENT_SCORE === "Positivo").length,
      Neutro: filteredData.filter(r => r.SENTIMENT_SCORE === "Neutro").length,
      Negativo: filteredData.filter(r => r.SENTIMENT_SCORE === "Negativo").length,
    };
    return [
      { name: "Positivo", value: counts.Positivo, color: "#22c55e" },
      { name: "Neutro", value: counts.Neutro, color: "#e5e7eb" },
      { name: "Negativo", value: counts.Negativo, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [filteredData]);

  const sourceData = useMemo(() => {
    if (filteredData.length === 0) return [];
    const counts: Record<string, number> = {};
    filteredData.forEach(r => {
      const src = r.SITO_ORIGINE || "Sconosciuto";
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const getWordCounts = (data: Review[]) => {
    const counts: Record<string, number> = {};
    data.forEach(r => {
      const words = (r.PAROLE_CHIAVE_ESTRATTE || "").split(",")
        .map(w => w.trim().toLowerCase())
        .filter(w => w && w.length > 3 && w !== 'undefined' && w !== 'null');
      words.forEach(w => {
        counts[w] = (counts[w] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 30);
  };

  const positiveWords = useMemo(() => 
    getWordCounts(filteredData.filter(r => r.SENTIMENT_SCORE === "Positivo")), 
  [filteredData]);

  const negativeWords = useMemo(() => 
    getWordCounts(filteredData.filter(r => r.SENTIMENT_SCORE === "Negativo")), 
  [filteredData]);

  const resetFilters = () => {
    setSelectedSentiment(null);
    setSelectedWord(null);
    setSelectedSource(null);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Caricamento sentiment...</div>;
  if (error) return <div className="p-12 text-center bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>;

  if (!selectedProductId) return (
    <div className="p-12 text-center bg-gray-50 border border-dashed rounded-md">
      <Info className="h-12 w-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900">Nessun prodotto selezionato</h3>
      <p className="text-gray-500 mt-1">Seleziona un vino per vedere l&apos;analisi.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sentiment Analysis</h1>
          <p className="text-gray-500">{productDetails?.CANTINA} - {productDetails?.VINO}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bento-box">
          <p className="text-xs font-semibold text-gray-400 uppercase">Rating Medio</p>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-3xl font-bold text-gray-900">{stats?.avgRating.toFixed(1) || "0.0"}</p>
            <Star className="h-6 w-6 text-yellow-400 fill-current" />
          </div>
        </div>
        <div className="bento-box">
          <p className="text-xs font-semibold text-gray-400 uppercase">Sentiment Score</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats?.sentimentScore.toFixed(1) || "0.0"}%</p>
        </div>
        <div className="bento-box">
          <p className="text-xs font-semibold text-gray-400 uppercase">Totale Recensioni</p>
          <p className="text-3xl font-bold text-blue-900 mt-2">{stats?.total || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Colonna Sinistra: Donut + Fonti */}
        <div className="lg:col-span-1 space-y-6">
          {/* Donut Chart - Altezza ottimizzata 350px */}
          <div className="bg-white p-6 shadow-sm border rounded-sm h-[350px]">
            <h3 className="text-lg font-bold mb-4">Share of Sentiment</h3>
            {pieData.length > 0 ? (
              <div className="h-[80%]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                      label={renderCustomizedLabel}
                      labelLine={false}
                      onClick={(data) => setSelectedSentiment(data.name === selectedSentiment ? null : data.name)}
                      cursor="pointer"
                    >
                      {pieData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color} 
                          stroke={selectedSentiment === entry.name ? "#000" : "none"}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <RechartTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="Nessun dato sentiment" />
            )}
          </div>

          <div className="bg-white p-6 shadow-sm border rounded-sm h-[226px]">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Distribuzione per Fonte
            </h3>
            {sourceData.length > 0 ? (
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sourceData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    onClick={(data) => {
                      if (data && data.activeLabel) {
                        setSelectedSource(data.activeLabel === selectedSource ? null : data.activeLabel);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                    <RechartTooltip />
                    <Bar dataKey="value" barSize={24} radius={[0, 4, 4, 0]} cursor="pointer">
                      {sourceData.map((entry, index) => (
                        <BarCell 
                          key={`cell-${index}`} 
                          fill={selectedSource === entry.name ? "#1e40af" : "#93c5fd"} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="Nessun dato per fonte" />
            )}
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6 h-[600px] overflow-hidden">
          {/* 1. & 2. RIMOZIONE TESTO E MANTENIMENTO ICONE: Cosa apprezzano */}
          <div className="bg-white shadow-sm border rounded-sm flex-1 h-1/2 flex flex-col overflow-hidden relative group">
            <ThumbsUp className="h-6 w-6 text-green-700 absolute top-4 left-4 z-10 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="flex-1 min-h-0">
              <CustomWordCloud 
                words={positiveWords} 
                onWordClick={(w) => setSelectedWord(w === selectedWord ? null : w)}
                selectedWord={selectedWord}
                colorType="green"
              />
            </div>
          </div>

          {/* 1. & 2. RIMOZIONE TESTO E MANTENIMENTO ICONE: Aree di miglioramento */}
          <div className="bg-white shadow-sm border rounded-sm flex-1 h-1/2 flex flex-col overflow-hidden relative group">
            <ThumbsDown className="h-6 w-6 text-red-700 absolute top-4 left-4 z-10 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="flex-1 min-h-0">
              <CustomWordCloud 
                words={negativeWords} 
                onWordClick={(w) => setSelectedWord(w === selectedWord ? null : w)}
                selectedWord={selectedWord}
                colorType="red"
              />
            </div>
          </div>
        </div>

      </div>

      {/* Active Filters UI */}
      {(selectedSentiment || selectedWord || selectedSource) && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-blue-900">Filtri Attivi</h4>
            <button onClick={resetFilters} className="text-xs font-bold text-blue-600 hover:underline">Resetta tutto</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedSentiment && <span className="flex items-center gap-1 bg-white border border-blue-200 px-3 py-1 rounded-full text-xs text-blue-800">Sentiment: <strong>{selectedSentiment}</strong> <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedSentiment(null)} /></span>}
            {selectedSource && <span className="flex items-center gap-1 bg-white border border-blue-200 px-3 py-1 rounded-full text-xs text-blue-800">Fonte: <strong>{selectedSource}</strong> <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedSource(null)} /></span>}
            {selectedWord && <span className="flex items-center gap-1 bg-white border border-blue-200 px-3 py-1 rounded-full text-xs text-blue-800">Parola: <strong>{selectedWord}</strong> <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedWord(null)} /></span>}
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white shadow-sm border rounded-sm overflow-hidden">
        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Recensioni Filtrate</h3>
          <span className="text-xs text-gray-500 font-medium">{filteredData.length} risultati</span>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="text-xs uppercase text-gray-500">
                <th className="px-6 py-3 border-b">Data</th>
                <th className="px-6 py-3 border-b">Sito</th>
                <th className="px-6 py-3 border-b">Rating</th>
                <th className="px-6 py-3 border-b">Sentiment</th>
                <th className="px-6 py-3 border-b">Testo</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? filteredData.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 text-sm">
                  <td className="px-6 py-4 border-b whitespace-nowrap">{r.DATA_COMMENTO}</td>
                  <td className="px-6 py-4 border-b">{r.SITO_ORIGINE}</td>
                  <td className="px-6 py-4 border-b font-bold">{r.RATING_ORIGINALE} <Star className="inline h-3 w-3 text-yellow-400 fill-current" /></td>
                  <td className="px-6 py-4 border-b">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-bold",
                      r.SENTIMENT_SCORE === "Positivo" ? "bg-green-100 text-green-700" :
                      r.SENTIMENT_SCORE === "Negativo" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                    )}>{r.SENTIMENT_SCORE}</span>
                  </td>
                  <td className="px-6 py-4 border-b italic text-gray-600">{r.TESTO_COMMENTO}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">Nessuna recensione trovata.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SentimentAnalysis;
