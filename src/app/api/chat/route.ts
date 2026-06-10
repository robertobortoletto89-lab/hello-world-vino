import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface SessionUser {
  nome?: string;
  ruolo?: string;
  cantinaVisibile?: string;
  email?: string | null;
}

interface DatabaseVinoRow {
  NOME_PRODOTTO?: string;
  CANTINA?: string;
  [key: string]: string | number | boolean | undefined | null;
}

interface StoricoPrezzoRow {
  CANTINA?: string;
  DATA_ESTRAZIONE?: string;
  PREZZO_RILEVATO?: string | number | null;
  PREZZO_SCONTATO?: string | number | null;
  STOCKOUT?: string;
  NOME_PRODOTTO?: string;
  SITO_ORIGINE?: string;
  [key: string]: string | number | boolean | undefined | null;
}

interface SentimentElaboratoRow {
  NOME_PRODOTTO?: string;
  SENTIMENT_SCORE?: string;
  PAROLE_CHIAVE_ESTRATTE?: string;
  [key: string]: string | number | boolean | undefined | null;
}

interface ChatMessage {
  role: string;
  content?: string;
  parts?: Array<{ text?: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    let user = session?.user as SessionUser | undefined;

    if (!session || !session.user) {
      const demoCookie = req.cookies.get("kyria_demo_session")?.value;
      if (demoCookie === "admin_demo") {
        user = {
          nome: "Admin Demo",
          ruolo: "ADMIN",
          cantinaVisibile: "ALL"
        };
      } else {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const role = user.ruolo;
    const cantinaVisibile = user.cantinaVisibile;
    const isAdmin = role === "ADMIN" || user.email === "admin@antigravity.it";

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messaggi non validi" }, { status: 400 });
    }

    // 1. CARICAMENTO E PARSING DEI DATI CSV (SSOT)
    const dbPath = path.join(process.cwd(), "public", "data", "database_vini.csv");
    const storicoPath = path.join(process.cwd(), "public", "data", "storico_prezzi.csv");
    const sentimentPath = path.join(process.cwd(), "public", "data", "sentiment_vini_elaborato.csv");

    if (!fs.existsSync(dbPath) || !fs.existsSync(storicoPath) || !fs.existsSync(sentimentPath)) {
      return NextResponse.json({ error: "Database CSV non trovati" }, { status: 500 });
    }

    const dbContent = fs.readFileSync(dbPath, "utf8");
    const dbParsed = Papa.parse(dbContent, { 
      header: true, 
      skipEmptyLines: true, 
      delimiter: ";",
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
    });
    const dbData = dbParsed.data as DatabaseVinoRow[];

    const storicoContent = fs.readFileSync(storicoPath, "utf8");
    const storicoParsed = Papa.parse(storicoContent, { 
      header: true, 
      skipEmptyLines: true, 
      delimiter: ";",
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
    });
    const storicoData = storicoParsed.data as StoricoPrezzoRow[];

    const sentimentContent = fs.readFileSync(sentimentPath, "utf8");
    const sentimentParsed = Papa.parse(sentimentContent, { 
      header: true, 
      skipEmptyLines: true, 
      delimiter: ";",
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
    });
    const sentimentData = sentimentParsed.data as SentimentElaboratoRow[];

    // 2. FILTRAGGIO IN BASE AI PERMESSI
    let filteredPrices = storicoData;
    let filteredReviews = sentimentData;

    if (!isAdmin && cantinaVisibile !== "ALL") {
      // Filtro prezzi storico
      filteredPrices = storicoData.filter((p) => p.CANTINA === cantinaVisibile);

      // Costruzione mappa NOME_PRODOTTO -> CANTINA per filtrare il sentiment
      const productCantinaMap = new Map<string, string>();
      dbData.forEach((p) => {
        if (p.NOME_PRODOTTO && p.CANTINA) {
          productCantinaMap.set(p.NOME_PRODOTTO.trim().toLowerCase(), p.CANTINA.trim().toLowerCase());
        }
      });

      // Filtro recensioni
      filteredReviews = sentimentData.filter((r) => {
        const prodName = String(r.NOME_PRODOTTO || "").trim().toLowerCase();
        const cantina = productCantinaMap.get(prodName);
        return cantina === cantinaVisibile.trim().toLowerCase();
      });
    }

    // 3. CONDENSAZIONE DATI PER RIDURRE TOKEN
    const rawFilteredData = filteredPrices.map(p => ({
      ...p,
      DATA_ESTRAZIONE: p.DATA_ESTRAZIONE ? p.DATA_ESTRAZIONE.split(" ")[0] : ""
    }));
    const parseItalianDate = (dateStr: string) => {
      if (!dateStr) return 0;
      const parts = dateStr.split('/');
      if (parts.length !== 3) return 0;
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
    };
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const recentPrices = rawFilteredData.filter((row) => {
      const rowDate = parseItalianDate(row.DATA_ESTRAZIONE || "");
      return rowDate >= sevenDaysAgo;
    });

    const condensedPrices = recentPrices.map((p) => ({
      DATA: p.DATA_ESTRAZIONE,
      CANTINA: p.CANTINA,
      PROD: p.NOME_PRODOTTO,
      SITO: p.SITO_ORIGINE,
      PRZ: parseFloat(p.PREZZO_RILEVATO?.toString().replace(",", ".") || "0"),
      PRZ_SC: p.PREZZO_SCONTATO ? parseFloat(p.PREZZO_SCONTATO.toString().replace(",", ".")) : null,
      ST_OUT: p.STOCKOUT
    }));

    // Aggregazione sentiment
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    const keywordsMap: { [key: string]: number } = {};

    filteredReviews.forEach((r) => {
      const score = String(r.SENTIMENT_SCORE || "").trim().toLowerCase();
      if (score.includes("positiv")) positiveCount++;
      else if (score.includes("negativ")) negativeCount++;
      else neutralCount++;

      const kw = r.PAROLE_CHIAVE_ESTRATTE;
      if (kw) {
        kw.split(",").forEach((k: string) => {
          const cleanK = k.trim().toLowerCase();
          if (cleanK && cleanK.length > 2) {
            keywordsMap[cleanK] = (keywordsMap[cleanK] || 0) + 1;
          }
        });
      }
    });

    // Estrarre le top 10 parole chiave
    const topKeywords = Object.entries(keywordsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ");

    // 4. INIZIALIZZAZIONE GEMINI E CHIAMATA CONTESTUALIZZATA
    const apiKey = process.env.API_VINO;
    if (!apiKey) {
      return NextResponse.json({ error: "Chiave API_VINO non configurata" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "Sei KYRIA, l'Analista Quantitativo IA della piattaforma WineTech. Rispondi in modo formale e brutale sui numeri. Basati SOLO sui dati forniti. REGOLA GRAFICI: Se l'utente chiede confronti o andamenti, NON spiegare a parole. Rispondi includendo il payload dei dati racchiuso ESATTAMENTE tra i tag <CHART> e </CHART>. Il formato interno deve essere un JSON valido con questa struttura: {'chart_type': 'bar', 'title': 'Titolo', 'data': [{'name': 'Sito', 'value': 70}]}. Non aggiungere testo fuori dai tag se generi un grafico. IMPORTANTE: Quando l'utente ti chiede conteggi su prodotti esauriti o in 'Stockout', devi cercare esclusivamente le righe in cui la colonna 'STOCKOUT' contiene la stringa 'SI'."
    });

    const history = messages.slice(0, -1) as ChatMessage[];

    const safeHistory = history.map((msg) => ({
      role: msg.role === 'bot' || msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content || msg.parts?.[0]?.text || '' }]
    }));
    while (safeHistory.length > 0 && safeHistory[0].role === 'model') {
      safeHistory.shift();
    }

    const lastMessage = (messages[messages.length - 1] as ChatMessage | undefined)?.content || "";

    const promptConTesto = `CONTESTO DATI CORRENTI PER LA TUA VISIBILITÀ (${cantinaVisibile}):
---
DATI PREZZI STORICO (ULTIMI 7 GIORNI, max 100 righe):
${JSON.stringify(condensedPrices.slice(0, 100))}

TOTALI SENTIMENT RECENSIONI:
- Positive: ${positiveCount}
- Negative: ${negativeCount}
- Neutre: ${neutralCount}
- Top parole chiave sentiment: ${topKeywords}
---

DOMANDA UTENTE: ${lastMessage}`;

    const chat = model.startChat({
      history: safeHistory,
    });

    const result = await chat.sendMessage(promptConTesto);
    const responseText = result.response.text();

    return NextResponse.json({ content: responseText });
  } catch (error: unknown) {
    console.error("Errore API Chat Kyria:", error);
    const errorMessage = error instanceof Error ? error.message : "Errore interno del server";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
