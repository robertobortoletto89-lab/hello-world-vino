import requests
import pandas as pd
import time
import random # Aggiungiamo un pizzico di imprevedibilità umana
from datetime import datetime
import os
import cloudscraper # IL NOSTRO GRIMALDELLO
from curl_cffi import requests as stealth_requests

# --- 1. LA TUA LISTA DELLA SPESA (Aggiungi qui le altre bottiglie) ---
vini_da_estrarre = [
    {"WINE_ID": "8902890", "NOME_PRODOTTO": "Vino Spumante Brut Rosé", "ID_PRODOTTO": "SM-SPUM-BR-01",},
    {"WINE_ID": "1497432", "NOME_PRODOTTO": "Valdobbiadene Prosecco Superiore DOCG Extra Dry", "ID_PRODOTTO": "SM-PROS-ED-01",},
    {"WINE_ID": "10309", "NOME_PRODOTTO": "Valpolicella Ripasso Superiore DOC", "ID_PRODOTTO": "ZN-VALP-RS-01",},
    {"WINE_ID": "12179055", "NOME_PRODOTTO": "Valdobbiadene Prosecco Superiore DOCG", "ID_PRODOTTO": "ZN-PROS-SP-01",},
    ]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

def estrai_recensioni_vivino(vino, max_reviews=100):
    print(f"\n🍷 Inizio estrazione per: {vino['NOME_PRODOTTO']} (Max {max_reviews} recensioni)...")
    recensioni_estratte = []
    page = 1
    
    # Inizializziamo lo scraper avanzato simulando un browser Chrome su Windows
    scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True})
    
    while len(recensioni_estratte) < max_reviews:
        url = f"https://www.vivino.com/api/wines/{vino['WINE_ID']}/reviews?per_page=25&page={page}"
        
        try:
            # Usiamo curl_cffi per ingannare le impronte crittografiche
            response = stealth_requests.get(url, headers=HEADERS, impersonate="chrome110")
            
            if response.status_code != 200:
                print(f"⚠️ Errore {response.status_code}. Muro impenetrabile.")
                break

            data = response.json()
            reviews = data.get("reviews", [])
            
            if not reviews:
                break 
                
            for rev in reviews:
                giorno_raw = rev.get("created_at")
                giorno_formattato = datetime.strptime(giorno_raw, "%Y-%m-%dT%H:%M:%S.000Z").strftime("%Y-%m-%d") if giorno_raw else ""
                rating = rev.get("rating")
                testo = rev.get("note", "").replace(";", ",").replace("\n", " ")
                
                if testo and len(testo) > 5:
                    recensioni_estratte.append({
                        "DATA_COMMENTO": giorno_formattato,
                        "ID_PRODOTTO": vino['ID_PRODOTTO'],
                        "NOME_PRODOTTO": vino['NOME_PRODOTTO'],
                        "SITO_ECOMMERCE": "Vivino",
                        "RATING_ORIGINALE": rating,
                        "TESTO_ORIGINALE": testo
                    })
            
            print(f"   -> Pagina {page} completata. Totale parziale: {len(recensioni_estratte)}")
            page += 1
            
            # Pausa RANDOM (tra i 6 e i 10 secondi) per non sembrare un metronomo robotico
            time.sleep(random.uniform(6, 10))
            
        except Exception as e:
            print(f"Errore: {e}")
            break
            
    return recensioni_estratte[:max_reviews]

# --- 2. ESECUZIONE MULTIPLA E SALVATAGGIO ---
file_csv = "public/data/sentiment_vini_raw.csv"
tutte_le_recensioni = []

# Ciclo su tutte le bottiglie della lista
for vino in vini_da_estrarre:
    dati = estrai_recensioni_vivino(vino)
    tutte_le_recensioni.extend(dati)
    
    # Pausa lunghissima tattica per far "raffreddare" l'IP
    print("\n⏳ Pausa tattica di 30 secondi per eludere i radar...")
    time.sleep(random.uniform(30, 45))

if tutte_le_recensioni:
    df_nuovi = pd.DataFrame(tutte_le_recensioni)
    
    if os.path.isfile(file_csv):
        try:
            df_storico = pd.read_csv(file_csv, sep=';', encoding='utf-8-sig')
            df_finale = pd.concat([df_storico, df_nuovi], ignore_index=True)
            df_finale = df_finale.drop_duplicates(subset=['DATA_COMMENTO', 'NOME_PRODOTTO', 'TESTO_ORIGINALE'])
            df_finale.to_csv(file_csv, index=False, sep=';', encoding='utf-8-sig')
            print(f"\n✅ OPERAZIONE COMPLETATA! Salvate {len(df_finale)} recensioni in {file_csv}")
            
        except Exception as e:
            # IL SALVAVITA: Se non riesce a leggere, crea un file a parte!
            file_emergenza = f"public/data/sentiment_EMERGENZA_{datetime.now().strftime('%H%M%S')}.csv"
            df_nuovi.to_csv(file_emergenza, index=False, sep=';', encoding='utf-8-sig')
            print(f"\n🚨 ERRORE CRITICO in lettura del vecchio file: {e}")
            print(f"⚠️ Per non sovrascrivere, ho salvato i nuovi dati in: {file_emergenza}")
    else:
        df_nuovi.to_csv(file_csv, index=False, sep=';', encoding='utf-8-sig')
        print(f"\n✅ OPERAZIONE COMPLETATA! File creato da zero con {len(df_nuovi)} recensioni.")
               
    df_finale.to_csv(file_csv, index=False, sep=';', encoding='utf-8-sig')
    print(f"\n✅ OPERAZIONE COMPLETATA! Salvate {len(tutte_le_recensioni)} recensioni in {file_csv}")
else:
    print("\n❌ Nessuna recensione estratta.")