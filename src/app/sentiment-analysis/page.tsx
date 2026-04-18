"use client";

import { useEffect, useState, useMemo } from "react";
import { parseCSV } from "@/lib/csv-parser";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartTooltip, Legend
} from "recharts";
import { MessageSquare, Star, ThumbsUp, X } from "lucide-react";

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

const SentimentAnalysis = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [reviewsData, productsData] = await Promise.all([
          parseCSV<Review>("/data/sentiment_vini_elaborato.csv"),
          parseCSV<ProductInfo>("/data/database_vini.csv")
        ]);

        setReviews(reviewsData);
        
        // Filter unique products
        const uniqueProductsMap = new Map<string, ProductInfo>();
        productsData.forEach(p => {
          if (!uniqueProductsMap.has(p.ID_PRODOTTO)) {
            uniqueProductsMap.set(p.ID_PRODOTTO, p);
          }
        });
        setProducts(Array.from(uniqueProductsMap.values()));
      } catch (error) {
        console.error("Error loading sentiment data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const productOptions = useMemo(() => {
    const uniqueReviewProductIds = Array.from(new Set(reviews.map(r => r.ID_PRODOTTO)));
    return uniqueReviewProductIds.map(id => {
      const product = products.find(p => p.ID_PRODOTTO === id);
      return {
        id,
        label: product ? `${product.CANTINA} - ${product.VINO}` : id
      };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [reviews, products]);

  const filteredReviews = useMemo(() => {
    let filtered = selectedProductId === "all" 
      ? reviews 
      : reviews.filter(r => r.ID_PRODOTTO === selectedProductId);
    
    if (selectedWord) {
      filtered = filtered.filter(r => 
        r.TESTO_COMMENTO.toLowerCase().includes(selectedWord.toLowerCase()) ||
        (r.PAROLE_CHIAVE_ESTRATTE && r.PAROLE_CHIAVE_ESTRATTE.toLowerCase().includes(selectedWord.toLowerCase()))
      );
    }
    return filtered;
  }, [reviews, selectedProductId, selectedWord]);

  const stats = useMemo(() => {
    if (filteredReviews.length === 0) return null;
    
    const avgRating = filteredReviews.reduce((a, b) => a + Number(b.RATING_ORIGINALE || 0), 0) / filteredReviews.length;
    const positiveCount = filteredReviews.filter(r => r.SENTIMENT_SCORE === "Positivo").length;
    const sentimentScore = (positiveCount / filteredReviews.length) * 100;
    
    return {
      avgRating,
      sentimentScore,
      total: filteredReviews.length
    };
  }, [filteredReviews]);

  const pieData = useMemo(() => {
    const counts = {
      Positivo: filteredReviews.filter(r => r.SENTIMENT_SCORE === "Positivo").length,
      Neutro: filteredReviews.filter(r => r.SENTIMENT_SCORE === "Neutro").length,
      Negativo: filteredReviews.filter(r => r.SENTIMENT_SCORE === "Negativo").length,
    };
    return [
      { name: "Positivo", value: counts.Positivo, color: "#22c55e" },
      { name: "Neutro", value: counts.Neutro, color: "#e5e7eb" },
      { name: "Negativo", value: counts.Negativo, color: "#ef4444" },
    ];
  }, [filteredReviews]);

  const wordCloudData = useMemo(() => {
    const extractWords = (sentiment: string) => {
      const counts: Record<string, number> = {};
      reviews
        .filter(r => (selectedProductId === "all" || r.ID_PRODOTTO === selectedProductId) && r.SENTIMENT_SCORE === sentiment)
        .forEach(r => {
          const words = (r.PAROLE_CHIAVE_ESTRATTE || "").split(",").map(w => w.trim().toLowerCase());
          words.forEach(w => {
            if (w && w.length > 3) {
              counts[w] = (counts[w] || 0) + 1;
            }
          });
        });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    };

    return {
      positive: extractWords("Positivo"),
      negative: extractWords("Negativo")
    };
  }, [reviews, selectedProductId]);

  if (loading) return <div className="p-8">Caricamento sentiment...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Sentiment Analysis</h1>
        <select 
          className="p-2 border rounded-md shadow-sm"
          value={selectedProductId}
          onChange={(e) => {
            setSelectedProductId(e.target.value);
            setSelectedWord(null);
          }}
        >
          <option value="all">Tutti i Prodotti</option>
          {productOptions.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bento-box">
          <p className="text-xs font-semibold text-gray-400 uppercase">Rating Medio</p>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-3xl font-bold text-gray-900">{stats?.avgRating.toFixed(1)}</p>
            <Star className="h-6 w-6 text-yellow-400 fill-current" />
          </div>
        </div>

        <div className="bento-box">
          <p className="text-xs font-semibold text-gray-400 uppercase">Sentiment Score</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats?.sentimentScore.toFixed(1)}%</p>
        </div>

        <div className="bento-box">
          <p className="text-xs font-semibold text-gray-400 uppercase">Totale Recensioni</p>
          <p className="text-3xl font-bold text-blue-900 mt-2">{stats?.total}</p>
        </div>
      </div>

      {/* Middle Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div className="bg-white p-6 shadow-sm border rounded-sm h-[400px]">
          <h3 className="text-lg font-bold mb-4">Share of Sentiment</h3>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={pieData}
                innerRadius={80}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
                onClick={(data) => console.log("Filtered by", data.name)}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Word Clouds */}
        <div className="bg-white p-6 shadow-sm border rounded-sm">
          <h3 className="text-lg font-bold mb-6">Analisi Parole Chiave</h3>
          
          <div className="space-y-8">
            <div>
              <p className="text-xs font-bold text-green-600 uppercase mb-3">Positive</p>
              <div className="flex flex-wrap gap-2">
                {wordCloudData.positive.map(([word, count]) => (
                  <button
                    key={word}
                    onClick={() => setSelectedWord(word === selectedWord ? null : word)}
                    className={cn(
                      "px-3 py-1 rounded-full border transition-all",
                      selectedWord === word 
                        ? "bg-green-600 text-white border-green-700" 
                        : "bg-green-50 text-green-700 border-green-200 hover:border-green-400"
                    )}
                    style={{ fontSize: `${Math.min(1 + count * 0.1, 1.5)}rem` }}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-red-600 uppercase mb-3">Negative</p>
              <div className="flex flex-wrap gap-2">
                {wordCloudData.negative.map(([word, count]) => (
                  <button
                    key={word}
                    onClick={() => setSelectedWord(word === selectedWord ? null : word)}
                    className={cn(
                      "px-3 py-1 rounded-full border transition-all",
                      selectedWord === word 
                        ? "bg-red-600 text-white border-red-700" 
                        : "bg-red-50 text-red-700 border-red-200 hover:border-red-400"
                    )}
                    style={{ fontSize: `${Math.min(1 + count * 0.1, 1.5)}rem` }}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Word Filter Header */}
      {selectedWord && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md flex justify-between items-center">
          <p className="text-blue-800 font-medium">
            Filtrando recensioni che contengono: <span className="font-bold underline">{selectedWord}</span>
          </p>
          <button 
            onClick={() => setSelectedWord(null)}
            className="text-blue-800 hover:bg-blue-100 p-1 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Bottom Section: Table */}
      <div className="bg-white shadow-sm border rounded-sm overflow-hidden">
        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Ultime Recensioni
          </h3>
          <span className="text-xs text-gray-500 font-medium">{filteredReviews.length} risultati</span>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-xs uppercase text-gray-500 bg-gray-50">
                <th className="px-6 py-3 border-b">Data</th>
                <th className="px-6 py-3 border-b">Sito</th>
                <th className="px-6 py-3 border-b">Rating</th>
                <th className="px-6 py-3 border-b">Sentiment</th>
                <th className="px-6 py-3 border-b">Testo</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors text-sm">
                  <td className="px-6 py-4 border-b whitespace-nowrap">{r.DATA_COMMENTO}</td>
                  <td className="px-6 py-4 border-b">{r.SITO_ORIGINE}</td>
                  <td className="px-6 py-4 border-b">
                    <div className="flex items-center gap-1">
                      <span className="font-bold">{r.RATING_ORIGINALE}</span>
                      <Star className="h-3 w-3 text-yellow-400 fill-current" />
                    </div>
                  </td>
                  <td className="px-6 py-4 border-b">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-bold",
                      r.SENTIMENT_SCORE === "Positivo" ? "bg-green-100 text-green-700" :
                      r.SENTIMENT_SCORE === "Negativo" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                    )}>
                      {r.SENTIMENT_SCORE}
                    </span>
                  </td>
                  <td className="px-6 py-4 border-b italic text-gray-600 line-clamp-2 hover:line-clamp-none cursor-pointer">
                    {r.TESTO_COMMENTO}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

export default SentimentAnalysis;
