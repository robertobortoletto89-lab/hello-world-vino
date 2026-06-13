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

    // 1. CARICAMENTO E PARSING DEI DATI CSV (TUTTI E TRE I FILE CONTESTUALMENTE)
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

    // Filtro per cantina visibile (se specificata e diversa da ALL)
    const filterCantina = (cantinaVisibile && cantinaVisibile !== "ALL" && cantinaVisibile !== "ALL_CANTINE") 
      ? String(cantinaVisibile).trim().toLowerCase() 
      : null;

    let filteredDb = dbData;
    let filteredStorico = storicoData;
    let filteredSentiment = sentimentData;

    if (filterCantina) {
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

    // 2. COSTRUZIONE MEMORIA CONVERSAZIONALE
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

    // 3. SYSTEM PROMPT CON REGOLE FERREE
    let systemInstruction = `Sei l'Assistente Copilot della piattaforma WineTech. Rispondi in italiano.
Segui SCRUPOLOSAMENTE le seguenti regole ferree:
1. Rispondi SEMPRE E SOLO con testo chiaro, formattato in Markdown o tabelle Markdown. È ASSOLUTAMENTE VIETATA la generazione di qualsiasi codice per grafici Recharts (come grafici a barre o a ciambella o altri componenti visuali). Ti devi basare esclusivamente sui numeri in modo testuale, chiaro e conciso. Non generare tag HTML, componenti React, o grafici di alcun tipo.
2. Per associare lo storico dei prezzi al PREZZO_BASE corretto, fai un join logico tra i dataset usando ID_PRODOTTO o NOME_PRODOTTO.
3. Per calcolare il 'Sottocosto' o 'Prezzo sotto base', DEVI confrontare il 'PREZZO_RILEVATO' o 'PREZZO_SCONTATO' (usa il prezzo scontato se presente e maggiore di 0) con il 'PREZZO_BASE' dell'anagrafica, oppure controllare se la colonna 'TRIGGER_REASON' è 'SOTTO_PREZZO'. Non inventare colonne o nomi di colonne diversi da quelli forniti.
4. Se l'utente chiede il 'Sentiment' di uno specifico vino, DEVI cercare quel nome o ID nel dataset del sentiment fornito e fornire le metriche (es. conteggio recensioni per polarità, star rating, e parole chiave) associate a quella specifica etichetta.
5. Se l'utente specifica una Cantina, tutte le risposte successive DEVONO essere filtrate per quella Cantina, a meno che non venga richiesto un reset.

Di seguito sono riportati i dati completi estratti dai file 'database_vini.csv', 'storico_prezzi.csv' e 'sentiment_vini_elaborato.csv' da utilizzare per rispondere ai quesiti:

=== DATI INIETTATI DAI FILE CSV ===
--- ANAGRAFICA VINI (database_vini.csv) ---
${dbCsv}

--- STORICO PREZZI (storico_prezzi.csv) ---
${storicoCsv}

--- SENTIMENT ED ELABORAZIONE RECENSIONI (sentiment_vini_elaborato.csv) ---
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
