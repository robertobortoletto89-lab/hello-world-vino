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

interface ChatMessage {
  role: string;
  content?: string;
  parts?: Array<{ text?: string }>;
}

interface DatabaseVinoRow {
  CANTINA?: string;
  ID_PRODOTTO?: string;
  NOME_PRODOTTO?: string;
  PREZZO_BASE?: string;
  [key: string]: string | undefined;
}

interface StoricoPrezzoRow {
  DATA_ESTRAZIONE?: string;
  ID_PRODOTTO?: string;
  CANTINA?: string;
  NOME_PRODOTTO?: string;
  SITO_ORIGINE?: string;
  SITO_ECOMMERCE?: string;
  PREZZO_RILEVATO?: string;
  PREZZO_SCONTATO?: string;
  STOCKOUT?: string;
  TRIGGER_REASON?: string;
  [key: string]: string | undefined;
}

interface SentimentElaboratoRow {
  ID_PRODOTTO?: string;
  CANTINA?: string;
  NOME_PRODOTTO?: string;
  SITO_ECOMMERCE?: string;
  RATING_ORIGINALE?: string;
  RATING?: string;
  SENTIMENT_SCORE?: string;
  PAROLE_CHIAVE_ESTRATTE?: string;
  TESTO_COMMENTO?: string;
  TESTO_ORIGINALE?: string;
  TESTO_RECENSIONE?: string;
  [key: string]: string | undefined;
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

    const { messages, selectedWineId } = await req.json();
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
    const dbParsed = Papa.parse<DatabaseVinoRow>(dbContent, { 
      header: true, 
      skipEmptyLines: true, 
      delimiter: ";",
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
    });
    const dbData = dbParsed.data;

    const storicoContent = fs.readFileSync(storicoPath, "utf8");
    const storicoParsed = Papa.parse<StoricoPrezzoRow>(storicoContent, { 
      header: true, 
      skipEmptyLines: true, 
      delimiter: ";",
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
    });
    const storicoData = storicoParsed.data;

    const sentimentContent = fs.readFileSync(sentimentPath, "utf8");
    const sentimentParsed = Papa.parse<SentimentElaboratoRow>(sentimentContent, { 
      header: true, 
      skipEmptyLines: true, 
      delimiter: ";",
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, '').toUpperCase()
    });
    const sentimentData = sentimentParsed.data;

    // 2. FILTRAGGIO IN BASE AI PERMESSI (RUOLO/CANTINA)
    let filteredDb = dbData;
    let filteredStorico = storicoData;
    let filteredSentiment = sentimentData;

    if (!isAdmin && cantinaVisibile && cantinaVisibile !== "ALL") {
      const filterCantina = cantinaVisibile.trim().toLowerCase();
      filteredDb = dbData.filter((r) => String(r.CANTINA || "").trim().toLowerCase() === filterCantina);
      filteredStorico = storicoData.filter((r) => String(r.CANTINA || "").trim().toLowerCase() === filterCantina);
      filteredSentiment = sentimentData.filter((r) => String(r.CANTINA || "").trim().toLowerCase() === filterCantina);
    }

    // Creazione dei dataset condensati da passare nel System Prompt
    const dbRows = filteredDb.map((row) => ({
      CANTINA: row.CANTINA || "",
      ID_PRODOTTO: row.ID_PRODOTTO || "",
      NOME_PRODOTTO: row.NOME_PRODOTTO || "",
      PREZZO_BASE: row.PREZZO_BASE || ""
    }));

    const storicoRows = filteredStorico.map((row) => ({
      DATA_ESTRAZIONE: row.DATA_ESTRAZIONE || "",
      ID_PRODOTTO: row.ID_PRODOTTO || "",
      CANTINA: row.CANTINA || "",
      NOME_PRODOTTO: row.NOME_PRODOTTO || "",
      SITO_ORIGINE: row.SITO_ORIGINE || row.SITO_ECOMMERCE || "",
      PREZZO_RILEVATO: row.PREZZO_RILEVATO || "",
      PREZZO_SCONTATO: row.PREZZO_SCONTATO || "",
      STOCKOUT: row.STOCKOUT || "",
      TRIGGER_REASON: row.TRIGGER_REASON || ""
    }));

    const sentimentRows = filteredSentiment.map((row) => ({
      ID_PRODOTTO: row.ID_PRODOTTO || "",
      CANTINA: row.CANTINA || "",
      NOME_PRODOTTO: row.NOME_PRODOTTO || "",
      SITO_ECOMMERCE: row.SITO_ECOMMERCE || "",
      RATING_ORIGINALE: row.RATING_ORIGINALE || row.RATING || "",
      SENTIMENT_SCORE: row.SENTIMENT_SCORE || "",
      PAROLE_CHIAVE_ESTRATTE: row.PAROLE_CHIAVE_ESTRATTE || "",
      TESTO_COMMENTO: String(row.TESTO_COMMENTO || row.TESTO_ORIGINALE || row.TESTO_RECENSIONE || "").substring(0, 120)
    }));

    const dbCsv = Papa.unparse(dbRows, { delimiter: ";" });
    const storicoCsv = Papa.unparse(storicoRows, { delimiter: ";" });
    const sentimentCsv = Papa.unparse(sentimentRows, { delimiter: ";" });

    // 3. SYSTEM PROMPT CON REGOLE FERREE
    let systemInstruction = `Sei l'Assistente Copilot (KYRIA) della piattaforma WineTech. Rispondi in italiano.
Segui SCRUPOLOSAMENTE le seguenti regole ferree:
1. Rispondi in Markdown o tabelle Markdown. È ASSOLUTAMENTE VIETATA la generazione di codice (Javascript, React, Recharts, HTML) per grafici o componenti visuali. Se devi mostrare andamenti o confronti, puoi includere il payload dei dati racchiuso ESATTAMENTE tra i tag <CHART> e </CHART> con la seguente struttura JSON: {"chart_type": "bar" | "line" | "pie", "title": "Titolo", "data": [{"name": "Etichetta", "value": Numero}]}. Non generare tag HTML generici, componenti React o codice di altro tipo.
2. Per associare lo storico dei prezzi al PREZZO_BASE corretto, fai un join logico tra i dataset usando ID_PRODOTTO o NOME_PRODOTTO.
3. Per calcolare il 'Sottocosto' o 'Prezzo sotto base', DEVI confrontare il 'PREZZO_RILEVATO' o 'PREZZO_SCONTATO' (usa il prezzo scontato se presente e maggiore di 0) con il 'PREZZO_BASE' dell'anagrafica, oppure controllare se la colonna 'TRIGGER_REASON' è 'SOTTO_PREZZO'. Non inventare colonne o nomi di colonne diversi da quelli reali.
4. Se l'utente chiede il 'Sentiment' di uno specifico vino, cerca quel nome o ID nel dataset del sentiment fornito e fornisci le metriche (es. polarità, rating originale, star rating, e parole chiave) associate a quella specifica etichetta.
5. Se l'utente specifica una Cantina, tutte le risposte successive DEVONO essere filtrate per quella Cantina, a meno che non venga richiesto un reset.
`;

    if (selectedWineId) {
      const wineObj = dbData.find((w) => w.ID_PRODOTTO === selectedWineId);
      const wineName = wineObj?.NOME_PRODOTTO || selectedWineId;
      systemInstruction += `\nATTENZIONE: Attualmente l'utente sta filtrando la dashboard per il vino "${wineName}" (ID: ${selectedWineId}). Concentra l'analisi iniziale su questa specifica etichetta, pur potendo rispondere su altri prodotti della stessa cantina si richiesto.`;
    }

    systemInstruction += `\n\n=== DATI INIETTATI DAI FILE CSV ===
--- ANAGRAFICA VINI (database_vini.csv) ---
${dbCsv}

--- STORICO PREZZI (storico_prezzi.csv) ---
${storicoCsv}

--- SENTIMENT ED ELABORAZIONE RECENSIONI (sentiment_vini_elaborato.csv) ---
${sentimentCsv}
================
`;

    // 4. PREPARAZIONE DELLA CRONOLOGIA DEI MESSAGGI
    const history = messages.slice(0, -1) as ChatMessage[];
    const lastMessage = (messages[messages.length - 1] as ChatMessage | undefined)?.content || "";

    const safeHistory = history.map((msg) => ({
      role: msg.role === 'bot' || msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content || msg.parts?.[0]?.text || '' }]
    }));
    while (safeHistory.length > 0 && safeHistory[0].role === 'model') {
      safeHistory.shift();
    }

    // Inizializzazione Gemini e chiamata
    const apiKey = process.env.API_VINO;
    if (!apiKey) {
      return NextResponse.json({ error: "Chiave API_VINO non configurata" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction,
    });

    const chat = model.startChat({
      history: safeHistory,
    });

    const result = await chat.sendMessage(lastMessage);
    const responseText = result.response.text();

    return NextResponse.json({ content: responseText });
  } catch (error: unknown) {
    console.error("Errore API Chat Kyria:", error);
    const errorMessage = error instanceof Error ? error.message : "Errore interno del server";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
