import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { promptId, vinoSelezionato, cantinaVisibile } = await req.json();

    if (!promptId || !vinoSelezionato || !cantinaVisibile) {
      return NextResponse.json({ error: "Parametri mancanti nel body" }, { status: 400 });
    }

    const pId = Number(promptId);
    let filePath = "";
    if (pId === 1 || pId === 2) {
      filePath = path.join(process.cwd(), "public", "data", "storico_prezzi.csv");
    } else if (pId === 3 || pId === 4) {
      filePath = path.join(process.cwd(), "public", "data", "sentiment_vini_elaborato.csv");
    } else {
      return NextResponse.json({ error: "promptId non valido" }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `File non trovato: ${path.basename(filePath)}` }, { status: 500 });
    }

    // Lettura e parsing manuale del CSV
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const lines = fileContent.split(/\r?\n/);
    if (lines.length === 0) {
      return NextResponse.json({ error: "File CSV vuoto" }, { status: 500 });
    }

    const headers = lines[0].split(";").map((h) => h.trim());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(";").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row);
    }

    // Filtro di sicurezza
    const filteredData = rows.filter((row) => {
      const rowCantina = row.CANTINA_VISIBILE || row.CANTINA;
      const matchCantina = cantinaVisibile === "ALL" || rowCantina === cantinaVisibile;
      const matchVino = row.NOME_PRODOTTO === vinoSelezionato;
      return matchCantina && matchVino;
    });

    if (filteredData.length === 0) {
      return NextResponse.json({ error: "Accesso Negato: nessun dato corrisponde alla visibilità e al vino selezionato" }, { status: 403 });
    }

    // Preparazione Payload IA
    let compactData: Record<string, string | null | undefined>[] = [];
    let systemInstruction = "";

    if (pId === 1) {
      compactData = filteredData.map((row) => ({
        STOCKOUT: row.STOCKOUT,
        DATA_ESTRAZIONE: row.DATA_ESTRAZIONE,
      }));
      systemInstruction = "Sei un assistente virtuale esperto di analisi stockout. Ti verranno forniti i dati storici del prodotto in formato JSON. Conta il numero di eventi in cui la colonna STOCKOUT è pari a 'SI'. Rispondi scrivendo ESCLUSIVAMENTE il numero totale di eventi in lettere in lingua italiana (es. 'cinque', 'zero', 'due'). Non aggiungere nessun altro testo.";
    } else if (pId === 2) {
      compactData = filteredData.map((row) => ({
        PREZZO_RILEVATO: row.PREZZO_RILEVATO,
        PREZZO_BASE: row.PREZZO_SCONTATO || row.PREZZO_RILEVATO,
        SITO_ECOMMERCE: row.SITO_ORIGINE || row.SITO_ECOMMERCE,
      }));
      systemInstruction = "Sei un assistente virtuale esperto di monitoraggio prezzi e anomalie di dumping. Ti verranno forniti i dati di prezzo in formato JSON. Esegui un'analisi discorsiva sintetica sul dumping dei prezzi, segnalando i siti web coinvolti e le deviazioni più rilevanti tra prezzo rilevato e prezzo base. Rispondi in italiano.";
    } else if (pId === 3) {
      compactData = filteredData.map((row) => ({
        RATING: row.RATING_ORIGINALE || row.RATING,
        TESTO_RECENSIONE: row.TESTO_COMMENTO || row.TESTO_ORIGINALE || row.TESTO_RECENSIONE,
      }));
      systemInstruction = "Sei un analista dati. Analizza i dati del sentiment forniti e conta il numero di recensioni positive, negative e neutre. Restituisci ESCLUSIVAMENTE un array JSON valido (senza blocchi markdown, senza tag, senza testo aggiuntivo) con la seguente struttura: [{\"sentiment\": \"positivo\", \"count\": X}, {\"sentiment\": \"negativo\", \"count\": Y}, {\"sentiment\": \"neutro\", \"count\": Z}].";
    } else if (pId === 4) {
      compactData = filteredData.map((row) => ({
        RATING: row.RATING_ORIGINALE || row.RATING,
        TESTO_RECENSIONE: row.TESTO_COMMENTO || row.TESTO_ORIGINALE || row.TESTO_RECENSIONE,
      }));
      systemInstruction = "Sei un assistente esperto in analisi dei testi e recensioni dei vini. Ti verranno forniti i dati di sentiment in formato JSON. Identifica la singola parola più frequente e usata (escludendo congiunzioni, articoli o preposizioni) e determina la polarità del sentiment complessivo del prodotto. Rispondi in formato sintetico come: 'Parola: [parola], Polarità: [polarità]'.";
    }

    // Chiamata Gemini API
    const apiKey = process.env.API_VINO;
    if (!apiKey) {
      return NextResponse.json({ error: "Chiave API_VINO non configurata" }, { status: 500 });
    }

    // Applica le restrizioni globali al System Prompt del Copilot
    const finalSystemInstruction = `${systemInstruction} Rispondi SEMPRE E SOLO con testo chiaro, formattato in Markdown o tabelle Markdown. È ASSOLUTAMENTE VIETATA la generazione di qualsiasi codice o markup per grafici (come grafici a barre, grafici a torta/ciambella o qualsiasi altro tipo di grafico). Ti devi basare esclusivamente sui numeri in modo testuale e conciso.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: finalSystemInstruction,
    });

    const promptText = `Dati del prodotto:\n${JSON.stringify(compactData)}`;
    const result = await model.generateContent(promptText);
    const aiResponse = result.response.text();

    return NextResponse.json({ message: aiResponse });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Errore Copilot API:", err);
    return NextResponse.json({ error: err.message || "Errore interno del server" }, { status: 500 });
  }
}
