import pandas as pd
from google import genai
from google.genai import types
import json
import time
import os

# --- 1. CONFIGURAZIONE API ---
import os
api_key = os.environ.get("API_VINO")
client = genai.Client(api_key=API_KEY)

# --- 2. IL PROMPT DI INGEGNERIA ---
PROMPT_SISTEMA = """
Sei un sommelier esperto e un analista di dati. Analizza questa recensione di un vino.
Devi restituire ESCLUSIVAMENTE un oggetto JSON valido con questa esatta struttura:
{
    "testo_tradotto": "Traduci la recensione in un italiano perfetto e scorrevole. Se è già in italiano, correggi eventuali errori ortografici.",
    "sentiment_generale": "Scegli ESATTAMENTE una tra: Positivo, Negativo, Neutro",
    "parole_positive": "Estrai solo le parole chiave o aggettivi che indicano pregi (es. profumato, elegante, buon rapporto qualità prezzo). Separate da virgola.",
    "parole_negative": "Estrai solo le parole chiave o aggettivi che indicano difetti (es. acido, tappato, costoso, sbilanciato). Separate da virgola."
}

Recensione da analizzare:
"""

def elabora_sentiment():
    file_input = 'sentiment_vini_raw.csv'
    file_output = 'sentiment_vini_elaborato.csv'

    if not os.path.exists(file_input):
        print(f"❌ Errore: File {file_input} non trovato. Lancia prima lo scraper di Vivino!")
        return

    print("🧠 Avvio Motore Sentiment (Cruise Control + Salvataggio Incrementale)...")
    df_raw = pd.read_csv(file_input, sep=';', encoding='utf-8-sig', engine='python')
    
    recensioni_gia_fatte = []
    if os.path.exists(file_output):
        df_esistente = pd.read_csv(file_output, sep=';', encoding='utf-8-sig', engine='python')
        if 'TESTO_ORIGINALE' in df_esistente.columns:
            recensioni_gia_fatte = df_esistente['TESTO_ORIGINALE'].tolist()

    for index, row in df_raw.iterrows():
        testo_originale = str(row.get('TESTO_COMMENTO', '')).strip()
        
        if not testo_originale or testo_originale in recensioni_gia_fatte:
            continue

        print(f"Analisi recensione {index + 1}/{len(df_raw)}...")
        
        successo = False
        for tentativo in range(3):
            try:
                risposta = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=PROMPT_SISTEMA + f'"{testo_originale}"',
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                    ),
                )
                
                dati_ia = json.loads(risposta.text)
                
                sentiment = dati_ia.get('sentiment_generale', 'Neutro')
                if sentiment == 'Positivo':
                    parole_estratte = dati_ia.get('parole_positive', '')
                elif sentiment == 'Negativo':
                    parole_estratte = dati_ia.get('parole_negative', '')
                else:
                    parole_estratte = dati_ia.get('parole_positive', '') + ", " + dati_ia.get('parole_negative', '')

                record = {
                    'DATA_COMMENTO': row.get('DATA_COMMENTO'),
                    'ID_PRODOTTO': row.get('ID_PRODOTTO'),
                    'NOME_PRODOTTO': row.get('NOME_PRODOTTO'),
                    'CATEGORIA_PRODOTTO': row.get('CATEGORIA_PRODOTTO'),
                    'SITO_ORIGINE': row.get('SITO_ORIGINE'),
                    'RATING_ORIGINALE': row.get('RATING_ORIGINALE'),
                    'TESTO_ORIGINALE': testo_originale,
                    'TESTO_COMMENTO': dati_ia.get('testo_tradotto', testo_originale),
                    'SENTIMENT_SCORE': sentiment,
                    'PAROLE_CHIAVE_ESTRATTE': parole_estratte.strip(', ')
                }
                
                # --- LA VERA CASSAFORTE: Salvataggio Immediato ---
                df_record = pd.DataFrame([record])
                if not os.path.exists(file_output):
                    # Se il file non esiste, lo crea con le intestazioni
                    df_record.to_csv(file_output, sep=';', encoding='utf-8-sig', index=False)
                else:
                    # Se il file esiste, si "accoda" (mode='a') in fondo senza riscrivere le intestazioni
                    df_record.to_csv(file_output, sep=';', encoding='utf-8-sig', index=False, mode='a', header=False)
                
                print(f"   💾 Salvata con successo su disco.")
                
                successo = True
                time.sleep(15) # Pausa di crociera
                break 
                
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    print(f"   ⏳ Limite API colpito. Pausa di 65 secondi... (Tentativo {tentativo + 1}/3)")
                    time.sleep(65)
                else:
                    print(f"   ⚠️ Errore API: {e}")
                    time.sleep(5)
        
        if not successo:
            print(f"❌ Recensione {index + 1} saltata.")

    print("🏁 Elaborazione terminata.")

if __name__ == "__main__":
    elabora_sentiment()