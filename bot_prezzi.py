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
        # Pulisce da euro, spazi invisibili e formatta il decimale
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
    # Arma Nucleare: JSON-LD
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
    # Vivino usa classi dinamiche, cerchiamo con regex
    tag = soup.find('span', class_=re.compile('purchaseAvailability__currentPrice'))
    if tag:
        p_orig = pulisci_prezzo(tag.text)
    return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}

# --- MOTORE PRINCIPALE ---
def avvia_scraping():
    # Sostituisci "prodotti.csv" con il nome esatto del tuo file di input
    FILE_INPUT = 'database_vini.csv' 
    FILE_OUTPUT = 'storico_prezzi.csv'
    
    if not os.path.exists(FILE_INPUT):
        print(f"Errore: File {FILE_INPUT} non trovato!")
        return

    df_input = pd.read_csv(FILE_INPUT)
    risultati = []
    oggi = datetime.now().strftime('%Y-%m-%d')

    for index, row in df_input.iterrows():
        sito = str(row['SITO_ECOMMERCE']).strip().lower()
        url = row['LINK']
        nome_vino = row['NOME_VINO']
        
        print(f"Scraping: {nome_vino} su {sito}...")
        
        try:
            response = requests.get(url, headers=HEADERS, timeout=10)
            if response.status_code != 200:
                print(f"  -> Blocco dal server (Status {response.status_code}). Salto.")
                continue
                
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Routing
            if 'tannico' in sito: dati = estrai_tannico(soup)
            elif 'callmewine' in sito: dati = estrai_callmewine(soup)
            elif 'vino.com' in sito: dati = estrai_vinocom(soup)
            elif 'xtrawine' in sito: dati = estrai_xtrawine(soup)
            elif 'bernabei' in sito: dati = estrai_bernabei(soup)
            elif 'vivino' in sito: