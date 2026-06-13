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
    // A. Controllo autorizzazione
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

    // 1. CARICAMENTO E PARSING DEI DATI CSV
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

    // 2. LOGICA DI PRE-FILTRAGGIO INTELLIGENTE IN JAVASCRIPT
    const allCantine = Array.from(new Set(dbData.map(r => r.CANTINA).filter(Boolean))) as string[];
    const allVini = dbData.map(r => ({
      id: r.ID_PRODOTTO || "",
      nome: r.NOME_PRODOTTO || "",
      cantina: r.CANTINA || ""
    })).filter(v => v.nome || v.id);

    let detectedCantina: string | null = null;
    let detectedWineId: string | null = null;
    let detectedWineName: string | null = null;

    // A. Filtro fisso basato sulla visibilità dell'utente (se non è Admin)
    if (!isAdmin && cantinaVisibile && cantinaVisibile !== "ALL") {
      detectedCantina = cantinaVisibile;
    }

    // B. Selezionato esplicitamente dalla dashboard
    if (selectedWineId) {
      detectedWineId = selectedWineId;
      const matched = allVini.find(v => v.id === selectedWineId);
      if (matched) {
        detectedWineName = matched.nome;
        if (!detectedCantina) detectedCantina = matched.cantina;
      }
    }

    // C. Analisi dei messaggi per menzioni
    let textToScan = "";
    messages.forEach((msg: ChatMessage) => {
      if (msg.role === "user") {
        textToScan += " " + (msg.content || "");
      }
    });
    textToScan = textToScan.toLowerCase();

    // Matching per Cantina (se non ancora bloccato dal ruolo)
    if (!detectedCantina) {
      for (const c of allCantine) {
        if (textToScan.includes(c.toLowerCase())) {
          detectedCantina = c;
          break;
        }
      }
    }

    // Matching per Vino (se non ancora bloccato dal selettore)
    if (!detectedWineId) {
      for (const v of allVini) {
        // Se l'utente non è admin, controlliamo che il vino appartenga alla sua cantina visibile
        if (detectedCantina && v.cantina.toLowerCase() !== detectedCantina.toLowerCase()) {
          continue;
        }
        if (
          (v.id && textToScan.includes(v.id.toLowerCase())) ||
          (v.nome && textToScan.includes(v.nome.toLowerCase()))
        ) {
          detectedWineId = v.id;
          detectedWineName = v.nome;
          if (!detectedCantina) detectedCantina = v.cantina;
          break;
        }
      }
    }

    // D. Applica i filtri estratti o fallbacks
    let filteredDb = dbData;
    let filteredStorico = storicoData;
    let filteredSentiment = sentimentData;
    let isFilteredByEntity = false;

    if (detectedWineId || detectedWineName) {
      isFilteredByEntity = true;
      const wId = detectedWineId ? detectedWineId.toLowerCase() : "";
      const wName = detectedWineName ? detectedWineName.toLowerCase() : "";

      filteredDb = dbData.filter(r => 
        (r.ID_PRODOTTO && r.ID_PRODOTTO.toLowerCase() === wId) || 
        (r.NOME_PRODOTTO && r.NOME_PRODOTTO.toLowerCase() === wName)
      );
      filteredStorico = storicoData.filter(r => 
        (r.ID_PRODOTTO && r.ID_PRODOTTO.toLowerCase() === wId) || 
        (r.NOME_PRODOTTO && r.NOME_PRODOTTO.toLowerCase() === wName)
      );
      filteredSentiment = sentimentData.filter(r => 
        (r.ID_PRODOTTO && r.ID_PRODOTTO.toLowerCase() === wId) || 
        (r.NOME_PRODOTTO && r.NOME_PRODOTTO.toLowerCase() === wName)
      );
    } else if (detectedCantina) {
      isFilteredByEntity = true;
      const cantinaLower = detectedCantina.toLowerCase();
      filteredDb = dbData.filter(r => String(r.CANTINA || "").toLowerCase() === cantinaLower);
      filteredStorico = storicoData.filter(r => String(r.CANTINA || "").toLowerCase() === cantinaLower);
      filteredSentiment = sentimentData.filter(r => String(r.CANTINA || "").toLowerCase() === cantinaLower);
    } else {
      // FALLBACK: Nessun filtro specifico cantina/vino rilevato -> Taglio a ultimi 7 giorni o max 50 righe
      const parseItalianDate = (dateStr: string) => {
        if (!dateStr) return 0;
        const parts = dateStr.split(" ")[0].split("/");
        if (parts.length !== 3) return 0;
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
      };

      // Trova data più recente storico
      let maxStoricoTime = 0;
      storicoData.forEach((row) => {
        const t = parseItalianDate(row.DATA_ESTRAZIONE || "");
        if (t > maxStoricoTime) maxStoricoTime = t;
      });

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const cutoffTime = maxStoricoTime > 0 ? maxStoricoTime - sevenDaysMs : 0;

      filteredStorico = storicoData.filter((row) => {
        const t = parseItalianDate(row.DATA_ESTRAZIONE || "");
        return t >= cutoffTime;
      });
      filteredStorico = filteredStorico
        .sort((a, b) => parseItalianDate(b.DATA_ESTRAZIONE || "") - parseItalianDate(a.DATA_ESTRAZIONE || ""))
        .slice(0, 50);

      // Trova data più recente sentiment
      let maxSentimentTime = 0;
      sentimentData.forEach((row) => {
        const t = parseItalianDate(row.DATA_COMMENTO || row.DATA || "");
        if (t > maxSentimentTime) maxSentimentTime = t;
      });
      const sentimentCutoff = maxSentimentTime > 0 ? maxSentimentTime - sevenDaysMs : 0;

      filteredSentiment = sentimentData.filter((row) => {
        const t = parseItalianDate(row.DATA_COMMENTO || row.DATA || "");
        return t >= sentimentCutoff;
      });
      filteredSentiment = filteredSentiment
        .sort((a, b) => parseItalianDate(b.DATA_COMMENTO || b.DATA || "") - parseItalianDate(a.DATA_COMMENTO || a.DATA || ""))
        .slice(0, 50);

      filteredDb = dbData.slice(0, 50);
    }

    // 3. GENERAZIONE DEL DATASET IN FORMATO CSV COMPATTO
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

    // 4. SYSTEM PROMPT CON INIEZIONE SICURA E REGOLE FERREE
    let systemInstruction = `Sei l'Assistente Copilot (KYRIA) della piattaforma WineTech. Rispondi in italiano.
Segui SCRUPOLOSAMENTE le seguenti regole ferree:
1. Rispondi in Markdown o tabelle Markdown. È ASSOLUTAMENTE VIETATA la generazione di codice (Javascript, React, Recharts, HTML) per grafici o componenti visuali. Se devi mostrare andamenti o confronti, puoi includere il payload dei dati racchiuso ESATTAMENTE tra i tag <CHART> e </CHART> con la seguente struttura JSON: {"chart_type": "bar" | "line" | "pie", "title": "Titolo", "data": [{"name": "Etichetta", "value": Numero}]}. Non generare tag HTML generici, componenti React o codice di altro tipo.
2. Per associare lo storico dei prezzi al PREZZO_BASE corretto, fai un join logico tra i dataset usando ID_PRODOTTO o NOME_PRODOTTO.
3. Per calcolare il 'Sottocosto' o 'Prezzo sotto base', DEVI confrontare il 'PREZZO_RILEVATO' o 'PREZZO_SCONTATO' (usa il prezzo scontato se presente e maggiore di 0) con il 'PREZZO_BASE' dell'anagrafica, oppure controllare se la colonna 'TRIGGER_REASON' è 'SOTTO_PREZZO'. Non inventare colonne o nomi di colonne diversi da quelli reali.
4. Se l'utente chiede il 'Sentiment' di uno specifico vino, cerca quel nome o ID nel dataset del sentiment fornito e fornisci le metriche (es. polarità, rating originale, star rating, e parole chiave) associate a quella specifica etichetta.
5. Se l'utente specifica una Cantina, tutte le risposte successive DEVONO essere filtrate per quella Cantina, a meno che non venga richiesto un reset.

AVVERTENZA CONTESTO DATI: Stai vedendo un ESTRATTO FILTRATO e ridotto del database complessivo. Questo filtro è stato calcolato lato server per ottimizzare i token ed evitare congestione di memoria.
Dati filtrati correnti:
${isFilteredByEntity 
  ? `- Filtrato per entità rilevata: ${detectedCantina || ""} ${detectedWineName || ""}` 
  : `- Nessun filtro specifico rilevato. Viene mostrato un estratto degli ultimi 7 giorni (max 50 righe per dataset)`}

=== ESTRATTO DATI INIETTATO DAI FILE CSV ===
--- ANAGRAFICA VINI (database_vini.csv) ---
${dbCsv}

--- STORICO PREZZI (storico_prezzi.csv) ---
${storicoCsv}

--- SENTIMENT ED ELABORAZIONE RECENSIONI (sentiment_vini_elaborato.csv) ---
${sentimentCsv}
================
`;

    if (selectedWineId) {
      const wineObj = dbData.find((w) => w.ID_PRODOTTO === selectedWineId);
      const wineName = wineObj?.NOME_PRODOTTO || selectedWineId;
      systemInstruction += `\nATTENZIONE: Attualmente l'utente sta filtrando la dashboard per il vino "${wineName}" (ID: ${selectedWineId}). Concentra l'analisi iniziale su questa specifica etichetta, pur potendo rispondere su altri prodotti della stessa cantina si richiesto.`;
    }

    // 5. PREPARAZIONE DELLA CRONOLOGIA DEI MESSAGGI
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
