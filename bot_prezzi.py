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
        pulito = testo.replace('€', '').replace('\xa0', '').strip()
        pulito = re.sub(r'[^\d,.-]', '', pulito).replace(',', '.')
        return float(pulito)
    except:
        return None

def estrai_tannico(soup):
    is_stockout = "non disponibile" in soup.text.lower()
    p_orig, p_scont = None, None
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
    return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}

def estrai_callmewine(soup):
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
    is_stockout = "non disponibile" in soup.text.lower()
    p_orig, p_scont = None, None
    tag_prezzo = soup.find(itemprop='price')
    if tag_prezzo:
        p_orig = pulisci_prezzo(tag_prezzo.get('content') or tag_prezzo.text)
    return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}

def estrai_xtrawine(soup):
    is_stockout = "non disponibile" in soup.text.lower()
    p_orig, p_scont = None, None
    tag_prezzo = soup.find('span', class_='notranslate ht-money')
    if tag_prezzo:
        p_orig = pulisci_prezzo(tag_prezzo.text)
    return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}

def estrai_bernabei(soup):
    is_stockout = "non disponibile" in soup.text.lower()
    p_orig, p_scont = None, None
    tag_prezzo = soup.find('span', {'itemprop': 'price'})
    if tag_prezzo:
        p_orig = pulisci_prezzo(tag_prezzo.text)
    return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}

def estrai_vivino(soup):
    is_stockout = "non disponibile" in soup.text.lower()
    p_orig, p_scont = None, None
    tag = soup.find('span', class_=re.compile('purchaseAvailability__currentPrice'))
    if tag:
        p_orig = pulisci_prezzo(tag.text)
    return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}

def avvia_scraping():
    # File input inviato da te:
    FILE_INPUT = 'database_vini.csv' 
    FILE_OUTPUT = 'storico_prezzi.csv'
    
    if not os.path.exists(FILE_INPUT):
        print(f"Errore: File {FILE_INPUT} non trovato!")
        return

    # Usiamo il separatore ; perché è quello italiano del tuo file
    df_input = pd.read_csv(FILE_INPUT, sep=';')
    risultati = []
    oggi = datetime.now().strftime('%Y-%m-%d')

    for index, row in df_input.iterrows():
        # Pulizia robusta in caso di celle vuote
        sito = str(row.get('SITO_ECOMMERCE', '')).strip().lower()
        url = str(row.get('LINK', '')).strip()
        nome_vino = row.get('VINO', 'Sconosciuto')
        
        if not url or url.lower() == 'nan':
            continue
            
        print(f"Scraping: {nome_vino} su {sito}...")
        
        dati = {'prezzo_originale': None, 'prezzo_scontato': None, 'stockout': False}
        
        try:
            response = requests.get(url, headers=HEADERS, timeout=10)
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                if 'tannico' in sito: dati = estrai_tannico(soup)
                elif 'callmewine' in sito: dati = estrai_callmewine(soup)
                elif 'vino.com' in sito: dati = estrai_vinocom(soup)
                elif 'xtrawine' in sito: dati = estrai_xtrawine(soup)
                elif 'bernabei' in sito: dati = estrai_bernabei(soup)
                elif 'vivino' in sito: dati = estrai_vivino(soup)
            else:
                print(f"  -> Blocco dal server (Status {response.status_code}).")
        except Exception as e:
            print(f"  -> Errore tecnico: {e}")

        # Clona l'intera riga originale e aggiunge in coda le 4 nuove metriche
        nuova_riga = row.to_dict()
        nuova_riga['DATA'] = oggi
        nuova_riga['PREZZO_RILEVATO'] = dati['prezzo_originale']
        nuova_riga['PREZZO_SCONTATO'] = dati['prezzo_scontato']
        nuova_riga['STOCKOUT'] = 'SI' if dati['stockout'] else 'NO'
        
        risultati.append(nuova_riga)

    # Salvataggio dati
    if risultati:
        df_nuovi = pd.DataFrame(risultati)
        if os.path.exists(FILE_OUTPUT):
            df_storico = pd.read_csv(FILE_OUTPUT, sep=';')
            df_finale = pd.concat([df_storico, df_nuovi], ignore_index=True)
        else:
            df_finale = df_nuovi
            
        # Salviamo in CSV con separatore ; in modo da non "fondere" mai più le colonne!
        df_finale.to_csv(FILE_OUTPUT, sep=';', index=False)
        print("✅ Database storico aggiornato con successo!")

if __name__ == "__main__":
    avvia_scraping()