"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line
} from "recharts";
import { MessageSquare, X, Send, Bot, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWine } from "@/context/WineContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChartPayload {
  chart_type: "bar" | "line" | "pie";
  title: string;
  data: Array<{ name: string; value: number }>;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AIChat() {
  const { 
    setSelectedCantina, 
    selectedWineId, 
    setSelectedWineId, 
    messages, 
    setMessages 
  } = useWine();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Custom chatbot states
  const [wines, setWines] = useState<Array<{ ID_PRODOTTO: string; NOME_PRODOTTO: string; CANTINA: string }>>([]);
  const [showDropdownFor, setShowDropdownFor] = useState<"anomalie" | "dumping" | "sentiment" | null>(null);
  const pathname = usePathname();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleReset = () => {
    setMessages([
      {
        role: "assistant",
        content: "Ciao, sono KYR-IA. In cosa ti posso aiutare oggi?"
      }
    ]);
  };

  useEffect(() => {
    setIsMounted(true);
    // Load wines
    fetch('/api/prodotti')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setWines(data);
        }
      })
      .catch(err => console.error("Errore nel caricamento prodotti per chatbot:", err));
  }, []);

  const checkForWineMention = (text: string) => {
    const lowerText = text.toLowerCase();
    
    const matchedWine = wines.find(w => {
      const name = w.NOME_PRODOTTO.toLowerCase();
      const id = w.ID_PRODOTTO.toLowerCase();
      
      const cleanName = name.replace(/["'“”]/g, "").trim();
      const cleanText = lowerText.replace(/["'“”]/g, "").trim();

      return (
        cleanText.includes(id) ||
        cleanText.includes(cleanName) ||
        (cleanText.length > 5 && cleanName.includes(cleanText))
      );
    });

    if (matchedWine) {
      console.log("Kyria intercettato menzione vino:", matchedWine);
      setSelectedCantina(matchedWine.CANTINA);
      setSelectedWineId(matchedWine.ID_PRODOTTO);
      return matchedWine.ID_PRODOTTO;
    }
    return null;
  };

  // Listen to state modifications from other parts of the app
  useEffect(() => {
    if (isMounted) {
      const handleExternalPrompt = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail) {
          setIsOpen(true);
          if (customEvent.detail.message) {
            promptHandlersRef.current.sendMessageText(customEvent.detail.message);
          } else if (customEvent.detail.pillType) {
            promptHandlersRef.current.handlePillClick(customEvent.detail.pillType);
          }
        }
      };

      window.addEventListener("trigger-kyria-prompt", handleExternalPrompt);
      
      return () => {
        window.removeEventListener("trigger-kyria-prompt", handleExternalPrompt);
      };
    }
  }, [isMounted]);

  // Proactive welcome message for the Home page
  useEffect(() => {
    if (isMounted && pathname === "/") {
      setMessages(prev => {
        if (prev.some(m => m.content.includes("Notifica di Sistema"))) return prev;
        return [
          {
            role: "assistant",
            content: "[Notifica di Sistema] Benvenuto nel Wine OS Command Center. Seleziona un'etichetta o usa le Azioni Rapide per avviare l'analisi predittiva."
          },
          ...prev
        ];
      });
    }
  }, [isMounted, pathname]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const sendMessageText = async (text: string) => {
    if (isLoading) return;

    // Intercetta menzione vino ed aggiorna il contesto globale
    const interceptedWineId = checkForWineMention(text);
    const activeWineId = interceptedWineId || selectedWineId;

    const userMessage: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          selectedWineId: activeWineId
        })
      });

      if (!response.ok) {
        throw new Error("Errore durante la comunicazione con KYRIA");
      }

      const data = await response.json();
      if (data.content) {
        setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Errore: risposta vuota da KYRIA." }]);
      }
    } catch (error: unknown) {
      const err = error as Error;
      setMessages(prev => [...prev, { role: "assistant", content: `Errore critico: ${err.message || "Impossibile contattare il server"}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePillClick = (promptType: "anomalie" | "dumping" | "sentiment") => {
    const wineId = selectedWineId;
    if (!wineId) {
      setShowDropdownFor(promptType);
    } else {
      launchPillPrompt(promptType, wineId);
    }
  };

  const launchPillPrompt = (promptType: "anomalie" | "dumping" | "sentiment", wineId: string) => {
    const wine = wines.find(w => w.ID_PRODOTTO === wineId);
    const wineName = wine?.NOME_PRODOTTO || wineId;
    
    let promptText = "";
    if (promptType === "anomalie") {
      promptText = `Effettua una scansione delle anomalie di prezzo negli ultimi 7 giorni per il vino ${wineName} (ID: ${wineId})`;
    } else if (promptType === "dumping") {
      promptText = `Mostra i peggiori casi di dumping di prezzo per il vino ${wineName} (ID: ${wineId})`;
    } else {
      promptText = `Fornisci un'analisi dei sentiment e delle recensioni negative per il vino ${wineName} (ID: ${wineId})`;
    }

    sendMessageText(promptText);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    await sendMessageText(text);
  };



  const parseMessageContent = (content: string) => {
    const chartRegex = /<CHART>([\s\S]*?)<\/CHART>/g;
    const parts: Array<{ type: "text"; data: string } | { type: "chart"; data: ChartPayload }> = [];
    let lastIndex = 0;
    let match;

    while ((match = chartRegex.exec(content)) !== null) {
      const index = match.index;
      if (index > lastIndex) {
        parts.push({
          type: "text",
          data: content.substring(lastIndex, index)
        });
      }
      try {
        const chartData = JSON.parse(match[1].trim());
        parts.push({
          type: "chart",
          data: chartData
        });
      } catch (err) {
        console.error("Errore di parsing JSON nel grafico:", err);
        parts.push({
          type: "text",
          data: match[0]
        });
      }
      lastIndex = chartRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: "text",
        data: content.substring(lastIndex)
      });
    }

    return parts;
  };

  const renderChart = (chart: ChartPayload) => {
    if (!isMounted) {
      return (
        <div className="h-44 flex items-center justify-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
          Inizializzazione grafico...
        </div>
      );
    }

    const { chart_type, title, data } = chart;

    return (
      <div className="my-4 p-3 bg-gray-50 rounded-xl border border-gray-200/60 shadow-sm text-gray-800">
        <h4 className="text-xs font-bold text-gray-700 mb-3 text-center uppercase tracking-wider">{title}</h4>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chart_type === "bar" ? (
              <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} stroke="#ccc" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#4b5563" }} />
                <YAxis tick={{ fontSize: 9, fill: "#4b5563" }} />
                <RechartTooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : chart_type === "line" ? (
              <LineChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} stroke="#ccc" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#4b5563" }} />
                <YAxis tick={{ fontSize: 9, fill: "#4b5563" }} />
                <RechartTooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
              </LineChart>
            ) : (
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartTooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 8, bottom: -5 }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const promptHandlersRef = useRef({ sendMessageText, handlePillClick });
  useEffect(() => {
    promptHandlersRef.current = { sendMessageText, handlePillClick };
  });

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border border-blue-500/20"
          aria-label="Open Kyria AI Chat"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Chat Container Window */}
      {isOpen && (
        <div className={cn(
          "flex flex-col w-[380px] sm:w-[420px] h-[550px] max-h-[85vh] bg-white border border-gray-200/80 rounded-2xl shadow-2xl transition-all duration-300 ease-out transform scale-100 overflow-hidden"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-blue-700 to-blue-600 text-white select-none">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
                <Bot className="w-5 h-5 text-blue-200" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-red-400 transition-colors"
                title="Nuova Chat / Reset"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title="Chiudi"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-3.5">
            {messages.map((msg, index) => {
              const isSystem = msg.content.startsWith("[Notifica di Sistema]");
              return (
                <div
                  key={index}
                  className={cn(
                    "flex flex-col rounded-2xl px-3.5 py-2.5 shadow-sm text-sm border transition-all",
                    msg.role === "user"
                      ? "max-w-[85%] bg-blue-600 border-blue-500 text-white rounded-br-none ml-auto"
                      : isSystem
                        ? "w-full bg-gray-100 border-gray-200 text-gray-600 text-center rounded-lg italic my-2 text-xs"
                        : "max-w-[85%] bg-white border-gray-200/80 text-gray-800 rounded-bl-none mr-auto"
                  )}
                >
                  {isSystem ? (
                    <p className="leading-relaxed">{msg.content.replace("[Notifica di Sistema] ", "")}</p>
                  ) : msg.role === "assistant" ? (
                    <div className="space-y-1">
                      {parseMessageContent(msg.content).map((part, pIdx) => (
                        <React.Fragment key={pIdx}>
                          {part.type === "text" ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  table: ({ ...props }) => (
                                    <div className="overflow-x-auto my-3 rounded-lg border border-gray-200">
                                      <table className="w-full border-collapse text-left text-xs" {...props} />
                                    </div>
                                  ),
                                  thead: ({ ...props }) => (
                                    <thead className="bg-gray-50 text-gray-700 font-semibold uppercase border-b border-gray-200" {...props} />
                                  ),
                                  th: ({ ...props }) => (
                                    <th className="px-4 py-2 border-r border-gray-200 last:border-r-0 font-bold" {...props} />
                                  ),
                                  td: ({ ...props }) => (
                                    <td className="px-4 py-2 border-t border-r border-gray-100 last:border-r-0 text-gray-600" {...props} />
                                  ),
                                  tr: ({ ...props }) => (
                                    <tr className="hover:bg-gray-50/50 even:bg-gray-50/20" {...props} />
                                  ),
                                  p: ({ ...props }) => (
                                    <p className="whitespace-pre-wrap leading-relaxed mb-2 last:mb-0" {...props} />
                                  )
                                }}
                              >
                                {part.data as string}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            renderChart(part.data as ChartPayload)
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none dark:prose-invert text-white">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex items-center gap-2 bg-white border border-gray-200/80 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm mr-auto max-w-[70%]">
                <span className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-75"></span>
                  <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-150"></span>
                  <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-300"></span>
                </span>
                <span className="text-xs text-gray-500 font-medium">KYRIA sta analizzando...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Inline Dropdown Selection */}
          {showDropdownFor && (
            <div className="px-3 py-2 bg-blue-50 border-t border-b border-blue-100 flex flex-col gap-1.5">
              <p className="text-[10px] font-bold text-blue-800 uppercase">Seleziona etichetta per procedere:</p>
              <div className="flex gap-2">
                <select 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const wineObj = wines.find(w => w.ID_PRODOTTO === val);
                      if (wineObj) {
                        setSelectedCantina(wineObj.CANTINA);
                      }
                      setSelectedWineId(val);
                      launchPillPrompt(showDropdownFor, val);
                      setShowDropdownFor(null);
                    }
                  }}
                  className="flex-1 text-xs bg-white border border-gray-200 rounded px-2 py-1 text-gray-800 outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>Scegli un vino...</option>
                  {wines.map(w => (
                    <option key={w.ID_PRODOTTO} value={w.ID_PRODOTTO}>
                      {w.NOME_PRODOTTO}
                    </option>
                  ))}
                </select>
                <button 
                  type="button" 
                  onClick={() => setShowDropdownFor(null)}
                  className="text-[10px] text-gray-500 hover:text-gray-700 px-2 py-1 bg-gray-100 rounded"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {/* Action Pills */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-1.5 select-none">
            <button
              type="button"
              onClick={() => handlePillClick("anomalie")}
              className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100 hover:border-blue-200 px-2 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer"
            >
              Scansione Anomalie
            </button>
            <button
              type="button"
              onClick={() => handlePillClick("dumping")}
              className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 hover:bg-rose-100 hover:border-rose-200 px-2 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer"
            >
              Top 3 Dumping
            </button>
            <button
              type="button"
              onClick={() => handlePillClick("sentiment")}
              className="text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-100 hover:bg-orange-100 hover:border-orange-200 px-2 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer"
            >
              Allarmi Sentiment
            </button>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Chiedi analisi su prezzi o sentiment..."
              className="flex-1 px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl outline-none transition-all placeholder:text-gray-400 text-gray-800"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-xl transition-all",
                input.trim() && !isLoading
                  ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
              )}
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
