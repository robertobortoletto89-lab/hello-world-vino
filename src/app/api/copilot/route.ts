import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface ChatMessage {
  role: string;
  content: string;
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
    const body = await req.json();
    const { promptId, vinoSelezionato, cantinaVisibile, messages } = body;

    // 1. COSTRUZIONE MEMORIA CONVERSAZIONALE E PREPARAZIONE TESTO
    let userPrompt = "";
    if (promptId) {
      const pId = Number(promptId);
      const wineName = vinoSelezionato || "tutti i vini";
      const cantinaName = cantinaVisibile || "tutte le cantine";
      if (pId === 1) {
        userPrompt = `Calcola stockout per il vino ${wineName} nella cantina ${cantinaName}`;
      } else if (pId === 2) {
        userPrompt = `Analizza dumping di prezzo per il vino ${wineName} nella cantina ${cantinaName}`;
      } else if (pId === 3) {
        userPrompt = `Analizza sentiment per il vino ${wineName} nella cantina ${cantinaName}`;
      } else if (pId === 4) {
        userPrompt = `Estrai parole chiave sentiment per il vino ${wineName} nella cantina ${cantinaName}`;
      } else {
        userPrompt = `Analizza vino ${wineName} nella cantina ${cantinaName}`;
      }
    }

    const messagesList = (messages && Array.isArray(messages) && messages.length > 0)
      ? messages
      : [{ role: "user", content: userPrompt || "Ciao, come posso aiutarti?" }];

    const history = messagesList.slice(0, -1) as ChatMessage[];
    const lastMessage = messagesList[messagesList.length - 1]?.content || userPrompt || "Ciao, come posso aiutarti?";

    const safeHistory = history.map((msg) => ({
      role: msg.role === 'bot' || msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content || '' }]
    }));
    while (safeHistory.length > 0 && safeHistory[0].role === 'model') {
      safeHistory.shift();
    }

    // 2. CARICAMENTO E PARSING DEI DATI CSV
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

    // 3. LOGICA DI PRE-FILTRAGGIO INTELLIGENTE IN JAVASCRIPT
    const allCantine = Array.from(new Set(dbData.map(r => r.CANTINA).filter(Boolean))) as string[];
    const allVini = dbData.map(r => ({
      id: r.ID_PRODOTTO || "",
      nome: r.NOME_PRODOTTO || "",
      cantina: r.CANTINA || ""
    })).filter(v => v.nome || v.id);

    let detectedCantina: string | null = null;
    let detectedWineId: string | null = null;
    let detectedWineName: string | null = null;

    // A. Controlla parametri espliciti della request
    if (cantinaVisibile && cantinaVisibile !== "ALL" && cantinaVisibile !== "ALL_CANTINE") {
      detectedCantina = cantinaVisibile;
    }
    if (vinoSelezionato) {
      detectedWineName = vinoSelezionato;
      const matched = allVini.find(v => 
        v.nome.toLowerCase() === vinoSelezionato.toLowerCase() || 
        v.id.toLowerCase() === vinoSelezionato.toLowerCase()
      );
      if (matched) {
        detectedWineId = matched.id;
        if (!detectedCantina) detectedCantina = matched.cantina;
      }
    }

    // B. Analizza l'intero storico dei messaggi dell'utente per trovare menzioni
    let textToScan = "";
    messagesList.forEach((msg) => {
      if (msg.role === "user") {
        textToScan += " " + (msg.content || "");
      }
    });
    textToScan = textToScan.toLowerCase();

    // Cerca match Cantina
    for (const c of allCantine) {
      if (textToScan.includes(c.toLowerCase())) {
        detectedCantina = c;
        break;
      }
    }

    // Cerca match Vino
    for (const v of allVini) {
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

    // C. Applica filtri o fallbacks temporali/quantitativi
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
      // D. FALLBACK: Nessun filtro specifico cantina/vino rilevato -> Taglio a ultimi 7 giorni o max 50 righe
      const parseItalianDate = (dateStr: string) => {
        if (!dateStr) return 0;
        const parts = dateStr.split(" ")[0].split("/");
        if (parts.length !== 3) return 0;
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
      };

      // Trova la data più recente nello storico
      let maxStoricoTime = 0;
      storicoData.forEach((row) => {
        const t = parseItalianDate(row.DATA_ESTRAZIONE || "");
        if (t > maxStoricoTime) maxStoricoTime = t;
      });

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const cutoffTime = maxStoricoTime > 0 ? maxStoricoTime - sevenDaysMs : 0;

      // Filtro storico per ultimi 7 giorni e taglio a max 50
      filteredStorico = storicoData.filter((row) => {
        const t = parseItalianDate(row.DATA_ESTRAZIONE || "");
        return t >= cutoffTime;
      });
      // Ordina storico per data decrescente e prendi max 50
      filteredStorico = filteredStorico
        .sort((a, b) => parseItalianDate(b.DATA_ESTRAZIONE || "") - parseItalianDate(a.DATA_ESTRAZIONE || ""))
        .slice(0, 50);

      // Trova la data più recente nel sentiment
      let maxSentimentTime = 0;
      sentimentData.forEach((row) => {
        const t = parseItalianDate(row.DATA_COMMENTO || row.DATA || "");
        if (t > maxSentimentTime) maxSentimentTime = t;
      });
      const sentimentCutoff = maxSentimentTime > 0 ? maxSentimentTime - sevenDaysMs : 0;

      // Filtro sentiment per ultimi 7 giorni e taglio a max 50
      filteredSentiment = sentimentData.filter((row) => {
        const t = parseItalianDate(row.DATA_COMMENTO || row.DATA || "");
        return t >= sentimentCutoff;
      });
      filteredSentiment = filteredSentiment
        .sort((a, b) => parseItalianDate(b.DATA_COMMENTO || b.DATA || "") - parseItalianDate(a.DATA_COMMENTO || a.DATA || ""))
        .slice(0, 50);

      // Limita il database anagrafica a max 50 righe per sicurezza
      filteredDb = dbData.slice(0, 50);
    }

    // 4. GENERAZIONE DEL DATASET IN FORMATO CSV COMPATTO
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

    // 5. SYSTEM PROMPT CON INIEZIONE SICURA E REGOLE FERREE
    let systemInstruction = `Sei l'Assistente Copilot della piattaforma WineTech. Rispondi in italiano.
Segui SCRUPOLOSAMENTE le seguenti regole ferree:
1. Rispondi SEMPRE E SOLO con testo chiaro, formattato in Markdown o tabelle Markdown. È ASSOLUTAMENTE VIETATA la generazione di qualsiasi codice per grafici Recharts (come grafici a barre o a ciambella o altri componenti visuali). Ti devi basare esclusivamente sui numeri in modo testuale, chiaro e conciso. Non generare tag HTML, componenti React, o grafici di alcun tipo.
2. Per associare lo storico dei prezzi al PREZZO_BASE corretto, fai un join logico tra i dataset usando ID_PRODOTTO o NOME_PRODOTTO.
3. Per calcolare il 'Sottocosto' o 'Prezzo sotto base', DEVI confrontare il 'PREZZO_RILEVATO' o 'PREZZO_SCONTATO' (usa il prezzo scontato se presente e maggiore di 0) con il 'PREZZO_BASE' dell'anagrafica, oppure controllare se la colonna 'TRIGGER_REASON' è 'SOTTO_PREZZO'. Non inventare colonne o nomi di colonne diversi da quelli forniti.
4. Se l'utente chiede il 'Sentiment' di uno specifico vino, DEVI cercare quel nome o ID nel dataset del sentiment fornito e fornire le metriche (es. conteggio recensioni per polarità, star rating, e parole chiave) associate a quella specifica etichetta.
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

--- SENTIMENT ED ELABORAZIONE RECENSIONE (sentiment_vini_elaborato.csv) ---
${sentimentCsv}
================
`;

    if (promptId) {
      const pId = Number(promptId);
      if (pId === 1) {
        systemInstruction += "\nConta il numero di eventi in cui la colonna STOCKOUT è pari a 'SI'. Rispondi scrivendo ESCLUSIVAMENTE il numero totale di eventi in lettere in lingua italiana (es. 'cinque', 'zero', 'due'). Non aggiungere nessun altro testo.";
      } else if (pId === 2) {
        systemInstruction += "\nEsegui un'analisi discorsiva sintetica sul dumping dei prezzi, segnalando i siti web coinvolti e le deviazioni più rilevanti tra prezzo rilevato e prezzo base.";
      } else if (pId === 3) {
        systemInstruction += "\nConta il numero di recensioni positive, negative e neutre. Restituisci ESCLUSIVAMENTE un array JSON valido (senza blocchi markdown, senza tag, senza testo aggiuntivo) con la seguente struttura: [{\"sentiment\": \"positivo\", \"count\": X}, {\"sentiment\": \"negativo\", \"count\": Y}, {\"sentiment\": \"neutro\", \"count\": Z}].";
      } else if (pId === 4) {
        systemInstruction += "\nIdentifica la singola parola più frequente e usata (escludendo congiunzioni, articoli o preposizioni) e determina la polarità del sentiment complessivo del prodotto. Rispondi in formato sintetico come: 'Parola: [parola], Polarità: [polarità]'.";
      }
    }

    // Chiamata Gemini API
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
    const aiResponse = result.response.text();

    return NextResponse.json({ message: aiResponse });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Errore Copilot API:", err);
    return NextResponse.json({ error: err.message || "Errore interno del server" }, { status: 500 });
  }
}
