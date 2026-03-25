import requests
import pandas as pd
import time
from datetime import datetime
import os

# 1. SETUP: Variabili del nostro vino "Esca"
WINE_ID = "2294030" 
NOME_PRODOTTO = "Cartizze Vigna La Rivetta"
ID_PRODOTTO = "VS-CART-LR-01" 
CATEGORIA = "Bollicine"

# Configurazione per sembrare un browser reale (Anti-Ban)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

def estrai_recensioni_vivino(wine_id, max_reviews=100):
    print(f"Inizio estrazione per {NOME_PRODOTTO} (Max {max_reviews} recensioni)...")
    recensioni_estratte = []
    page = 1
    
    while len(recensioni_estratte) < max_reviews:
        # Endpoint API interno di Vivino per le recensioni
        url = f"https://www.vivino.com/api/wines/{wine_id}/reviews?per_page=25&page={page}"
        
        try:
            response = requests.get(url, headers=HEADERS)
            
            # Se Vivino ci blocca, fermiamo tutto per proteggere l'IP
            if response.status_code != 200:
                print(f"Errore {response.status_code}. Raggiunto limite o blocco IP. Mi fermo.")
                break
                
            data = response.json()
            reviews = data.get("reviews", [])
            
            if not reviews:
                break # Non ci sono più recensioni
                
            for rev in reviews:
                # Estraiamo i dati crudi
                giorno_raw = rev.get("created_at")
                giorno_formattato = datetime.strptime(giorno_raw, "%Y-%m-%dT%H:%M:%S.000Z").strftime("%Y-%m-%d") if giorno_raw else ""
                rating = rev.get("rating")
                testo = rev.get("note", "").replace(";", ",").replace("\n", " ") # Puliamo il testo per non rompere il CSV
                
                # Aggiungiamo solo se c'è un testo scritto (i voti senza commento non ci servono per la sentiment)
                if testo and len(testo) > 5:
                    recensioni_estratte.append({
                        "DATA_COMMENTO": giorno_formattato,
                        "ID_PRODOTTO": ID_PRODOTTO,
                        "NOME_PRODOTTO": NOME_PRODOTTO,
                        "CATEGORIA_PRODOTTO": CATEGORIA,
                        "SITO_ORIGINE": "Vivino",
                        "RATING_ORIGINALE": rating,
                        "TESTO_COMMENTO": testo
                    })
            
            print(f"Pagina {page} completata. Trovate {len(recensioni_estratte)} recensioni finora.")
            page += 1
            time.sleep(2) # Pausa di 2 secondi tra una pagina e l'altra (Fondamentale per non farsi bannare)
            
        except Exception as e:
            print(f"Errore durante l'estrazione: {e}")
            break
            
    # Tagliamo l'array se abbiamo superato il massimo richiesto
    return recensioni_estratte[:max_reviews]

# Esecuzione e salvataggio
dati = estrai_recensioni_vivino(WINE_ID)

if dati:
    df_nuovi = pd.DataFrame(dati)
    file_csv = "sentiment_vini_raw.csv"
    
    # Salvataggio relazionale e blindato per Excel (utf-8-sig)
    if os.path.isfile(file_csv):
        try:
            df_storico = pd.read_csv(file_csv, sep=';', encoding='utf-8-sig')
            df_finale = pd.concat([df_storico, df_nuovi], ignore_index=True)
        except Exception as e:
            print(f"⚠️ Errore lettura vecchio file: {e}. Sovrascrivo con i nuovi dati.")
            df_finale = df_nuovi
    else:
        df_finale = df_nuovi
        
    df_finale.to_csv(file_csv, index=False, sep=';', encoding='utf-8-sig')
    print(f"✅ Successo! Salvate {len(dati)} recensioni in {file_csv}")
else:
    print("❌ Nessuna recensione estratta.")