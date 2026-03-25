import requests
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime
import re
import json
import os

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
}

def pulisci_prezzo(testo):
    if not testo: return None
    try:
        pulito = str(testo).replace('€', '').replace('\xa0', '').strip()
        pulito = re.sub(r'[^\d,.-]', '', pulito).replace(',', '.')
        return float(pulito)
    except:
        return None

# --- SCUDO ANTI-CRASH PER TANNICO ---
def estrai_tannico(soup):
    is_stockout = False
    if soup and soup.text:
        is_stockout = "non disponibile" in soup.text.lower()
    
    p_orig, p_scont = None, None
    try:
        contenitore = soup.find('div', {'data-controller': 'price'})
        if contenitore:
            scont_tag = contenitore.find('span', class_=re.compile('tw-text-blue|tw-text-red'))
            orig_tag = contenitore.find('span', class_=re.compile('tw-line-through'))
            if scont_tag:
                p_scont = pulisci_prezzo(scont_tag.text)
                p_orig = pulisci_prezzo(orig_tag.text) if orig_tag else p_scont
            else:
                base_tag = contenitore.find('span', class_=re.compile('tw-font-bold'))
                p_orig = pulisci_prezzo(base_tag.text) if base_tag else None
        else:
            print("    ⚠️ Tannico: Contenitore prezzo non trovato. Layout cambiato o blocco.")
    except Exception as e:
        print(f"    ⚠️ Errore estrazione Tannico: {e}")
        
    return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}

def estrai_callmewine(soup):
    is_stockout = False
    if soup and soup.text:
        is_stockout = "non disponibile" in soup.text.lower() or "esaurito" in soup.text.lower()
    p_orig, p_scont = None, None
    scripts = soup.find_all('script', type='application/ld+json')
    for script in scripts:
        try:
            dati = json.loads(script.string)
            if 'offers' in dati and 'price' in dati['offers']:
                p_orig = float(dati['offers']['price'])
                break
        except:
            continue
    return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}

def estrai_vinocom(soup):
    is_stockout = False
    if soup and soup.text:
        is_stockout = "non disponibile" in soup.text.lower()
    p_orig, p_scont = None, None
    tag_prezzo = soup.find(itemprop='price')
    if tag_prezzo:
        p_orig = pulisci_prezzo(tag_prezzo.get('content') or tag_prezzo.text)
    return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}

def estrai_xtrawine(soup):
    html_str = str(soup)
    is_stockout = "non disponibile" in html_str.lower() or "esaurito" in html_str.lower()
    p_orig = None
    
    match_js = re.findall(r'["\']price["\']\s*:\s*["\']?(\d+[,\.]\d+)["\']?', html_str, re.IGNORECASE)
    for p in match_js:
        val = pulisci_prezzo(p)
        if val and val > 0: 
            p_orig = val
            break
            
    if not p_orig:
        prezzi_euro = re.findall(r'(\d+[,\.]\d{2})\s*€|€\s*(\d+[,\.]\d{2})', soup.text)
        for p_tupla in prezzi_euro:
            p_testo = p_tupla[0] if p_tupla[0] else p_tupla[1]
            val = pulisci_prezzo(p_testo)
            if val and val > 0:
                p_orig = val
                break

    return {'prezzo_originale': p_orig, 'prezzo_scontato': None, 'stockout': is_stockout}

def estrai_bernabei(soup):
    is_stockout = False
    if soup and soup.text:
        is_stockout = "non disponibile" in soup.text.lower()
    p_orig, p_scont = None, None
    tag_prezzo = soup.find('span', {'itemprop': 'price'})
    if tag_prezzo:
        p_orig = pulisci_prezzo(tag_prezzo.text)
    return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}

def avvia_scraping():
    FILE_INPUT = 'database_vini.csv' 
    FILE_OUTPUT = 'storico_prezzi.csv'
    
    if not os.path.exists(FILE_INPUT):
        print(f"Errore: File {FILE_INPUT} non trovato!")
        return

    # 1. Lettura rigorosa
    try:
        df_input = pd.read_csv(FILE_INPUT, sep=';', encoding='utf-8-sig', engine='python')
    except Exception as e:
        print(f"Errore critico di lettura anagrafica: {e}")
        return

    # Pulizia spazi invisibili dalle intestazioni
    df_input.columns = df_input.columns.str.strip().str.upper()

    risultati = []
    oggi = datetime.now().strftime('%d/%m/%Y')

    for index, row in df_input.iterrows():
        # UTILIZZO DEL DIZIONARIO DATI CON "SITO_ORIGINE"
        url = str(row.get('LINK_SCRAPING', '')).strip() 
        nome_prodotto = str(row.get('NOME_PRODOTTO', 'Sconosciuto')).strip()
        sito_origine = str(row.get('SITO_ORIGINE', '')).strip().lower()
        
        if not url or url.lower() == 'nan':
            continue
            
        print(f"Scraping: {nome_prodotto} su {sito_origine}...")
        dati = {'prezzo_originale': None, 'prezzo_scontato': None, 'stockout': False}
        
        try:
            response = requests.get(url, headers=HEADERS, timeout=15)
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                if 'tannico' in sito_origine: dati = estrai_tannico(soup)
                elif 'callmewine' in sito_origine: dati = estrai_callmewine(soup)
                elif 'vino.com' in sito_origine: dati = estrai_vinocom(soup)
                elif 'xtrawine' in sito_origine: dati = estrai_xtrawine(soup)
                elif 'bernabei' in sito_origine: dati = estrai_bernabei(soup)
            else:
                print(f"    -> Blocco dal server (Status {response.status_code}).")
        except Exception as e:
            print(f"    -> Errore di connessione: {e}")

        # 2. COSTRUZIONE DELLA RIGA (Solo 7 colonne come da Dizionario)
        record = {
            'DATA_ESTRAZIONE': oggi,
            'NOME_PRODOTTO': nome_prodotto,
            'SITO_ORIGINE': sito_origine.capitalize(),
            'PREZZO_RILEVATO': dati['prezzo_originale'] if dati['prezzo_originale'] else 0.0,
            'PREZZO_SCONTATO': dati['prezzo_scontato'] if dati['prezzo_scontato'] else 0.0,
            'STOCKOUT': 'SI' if dati['stockout'] else 'NO',
            'LINK_SCRAPING': url
        }
        risultati.append(record)

    # 3. SALVATAGGIO DATI NORMALIZZATO
    if risultati:
        df_nuovi = pd.DataFrame(risultati)
        
        # Ordine esatto da Dizionario Dati
        ordine_colonne = ['DATA_ESTRAZIONE', 'NOME_PRODOTTO', 'SITO_ORIGINE', 'PREZZO_RILEVATO', 'PREZZO_SCONTATO', 'STOCKOUT', 'LINK_SCRAPING']
        df_nuovi = df_nuovi[ordine_colonne]
        
        if os.path.exists(FILE_OUTPUT):
            try:
                df_storico = pd.read_csv(FILE_OUTPUT, sep=';', encoding='utf-8-sig', engine='python')
                df_storico.columns = df_storico.columns.str.strip().str.upper()
                
                # Mapper avanzato per salvare lo storico e portarlo al nuovo standard
                mappature = {
                    'DATA': 'DATA_ESTRAZIONE', 
                    'DATA_RILEVAZIONE': 'DATA_ESTRAZIONE',
                    'VINO': 'NOME_PRODOTTO', 
                    'SHOP': 'SITO_ORIGINE', 
                    'PIATTAFORMA': 'SITO_ORIGINE',
                    'SITO_ECOMMERCE': 'SITO_ORIGINE',
                    'LINK': 'LINK_SCRAPING', 
                    'LINK SCRAPING': 'LINK_SCRAPING'
                }
                df_storico.rename(columns={k: v for k, v in mappature.items() if k in df_storico.columns}, inplace=True)
                
                # Taglia via tutte le colonne in più (Cantina, Descrizione, ecc.) dallo storico
                colonne_valide = [c for c in df_storico.columns if c in ordine_colonne]
                df_storico = df_storico[colonne_valide]

                df_finale = pd.concat([df_storico, df_nuovi], ignore_index=True)
            except Exception as e:
                print(f"⚠️ Errore lettura storico: {e}. Salvo solo i dati di oggi.")
                df_finale = df_nuovi
        else:
            df_finale = df_nuovi
            
        # Salvataggio finale blindato (utf-8-sig + ;)
        df_finale.to_csv(FILE_OUTPUT, sep=';', encoding='utf-8-sig', index=False)
        print("✅ Database storico aggiornato con successo (SITO_ORIGINE allineato)!")

if __name__ == "__main__":
    avvia_scraping()