import requests
from bs4 import BeautifulSoup
import json
import re
import csv
import os
from datetime import datetime
import pandas as pd

# Headers realistici per eludere i blocchi
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.google.com/'
}

def pulisci_prezzo(testo):
    """Pulisce la stringa del prezzo e la converte in float."""
    if not testo:
        return None
    
    # Estrae il testo, togli € e spazi
    prezzo_str = str(testo).replace('€', '').strip()
    # Rimuovi tutti gli spazi vuoti (anche quelli interni)
    prezzo_str = "".join(prezzo_str.split())
    
    if not prezzo_str:
        return None

    # Gestione separatori: 1.250,50 -> 1250.50
    if ',' in prezzo_str and '.' in prezzo_str:
        # Se la virgola è l'ultimo separatore (formato europeo 1.250,50)
        if prezzo_str.rfind(',') > prezzo_str.rfind('.'):
            prezzo_str = prezzo_str.replace('.', '').replace(',', '.')
        else: # Formato US 1,250.50
            prezzo_str = prezzo_str.replace(',', '')
    elif ',' in prezzo_str:
        # Solo virgola (12,50)
        prezzo_str = prezzo_str.replace(',', '.')
    
    # Rimuovi tutto ciò che non è numero o punto
    prezzo_str = re.sub(r'[^\d.]', '', prezzo_str)
    
    try:
        valore = float(prezzo_str)
        return valore if valore > 0 else None
    except (ValueError, TypeError):
        return None

def check_stockout(soup):
    """Verifica se il prodotto è esaurito cercando parole chiave nel testo."""
    testo_pagina = soup.get_text().lower()
    keywords = ["non disponibile", "esaurito", "out of stock", "prodotto terminato", "avvisami quando tornerà"]
    return any(k in testo_pagina for k in keywords)

def cerca_prezzo_barrato(soup):
    """Cerca tag che solitamente contengono il prezzo originale barrato."""
    classi_sconto = ['line-through', 'old-price', 'regular-price', 'original-price', 'crossed']
    for classe in classi_sconto:
        tag = soup.find(class_=re.compile(classe, re.I))
        if tag:
            return pulisci_prezzo(tag.get_text())
    
    # Cerca tag <del> o <s>
    tag_del = soup.find(['del', 's'])
    if tag_del:
        return pulisci_prezzo(tag_del.get_text())
    
    return None

def estrai_prezzo_tannico(url):
    is_stockout = False
    p_orig = None
    p_scont = None
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        is_stockout = check_stockout(soup)
        
        # Tannico: cerca il container con data-controller="price"
        price_container = soup.find('div', {'data-controller': 'price'})
        if price_container:
            # Prezzo originale (barrato)
            originale_tag = price_container.find(class_=re.compile(r'tw-line-through'))
            if originale_tag:
                p_orig = pulisci_prezzo(originale_tag.get_text())
            
            # Prezzo scontato (colorato e bold)
            scontato_tag = price_container.find(class_=lambda x: x and ('tw-text-blue' in x or 'tw-text-red' in x) and 'tw-font-bold' in x)
            if scontato_tag:
                p_scont = pulisci_prezzo(scontato_tag.get_text())
            
            # Se non abbiamo trovato nulla nel container specifico, proviamo il fallback
            if not p_scont and not p_orig:
                p_orig = pulisci_prezzo(price_container.get_text())
            elif p_scont and not p_orig:
                # Se abbiamo trovato solo quello scontato/bold, lo mettiamo in originale
                p_orig = p_scont
                p_scont = None
        
        return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}
    except Exception:
        return {'prezzo_originale': None, 'prezzo_scontato': None, 'stockout': False}

def estrai_prezzo_vinocom(url):
    is_stockout = False
    p_orig = None
    p_scont = None
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        is_stockout = check_stockout(soup)
            
        p_barrato = cerca_prezzo_barrato(soup)
        # Prezzo vendita tipico di Vino.com
        sale_tag = soup.find('span', class_='watc-sale-price') or soup.find(itemprop='price')
        p_vendita = pulisci_prezzo(sale_tag.get_text() if sale_tag else None)
        
        if p_barrato and p_vendita:
            p_orig = p_barrato
            p_scont = p_vendita
        else:
            p_orig = p_vendita
            
        return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}
    except Exception:
        return {'prezzo_originale': None, 'prezzo_scontato': None, 'stockout': False}

def estrai_prezzo_callmewine(url):
    is_stockout = False
    p_orig = None
    p_scont = None
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            print(f"Errore Callmewine: Status {response.status_code} per {url}")
            return {'prezzo_originale': None, 'prezzo_scontato': None, 'stockout': False}

        soup = BeautifulSoup(response.text, 'html.parser')
        is_stockout = check_stockout(soup)
        
        # Tentativo 1: JSON-LD (Dati Strutturati Google)
        try:
            script_tags = soup.find_all('script', type='application/ld+json')
            for tag in script_tags:
                try:
                    if not tag.string: continue
                    data = json.loads(tag.string)
                    
                    # Gestione sia di oggetto singolo che di lista @graph
                    items = data if isinstance(data, list) else [data]
                    if '@graph' in data: items = data['@graph']
                    
                    for item in items:
                        if 'offers' in item:
                            offers = item['offers']
                            # offers può essere lista o oggetto
                            if isinstance(offers, list): offers = offers[0]
                            
                            if 'price' in offers:
                                p_orig = pulisci_prezzo(offers['price'])
                                if p_orig: break
                    if p_orig: break
                except (json.JSONDecodeError, KeyError, TypeError):
                    continue
        except Exception as e:
            print(f"Errore nel parsing JSON-LD: {e}")

        # Tentativo 2: Regex Brutale Fallback
        if p_orig is None:
            match = re.search(r'(\d+[,\.]\d{2})\s*€', soup.text)
            if match:
                p_orig = pulisci_prezzo(match.group(1))

        return {'prezzo_originale': p_orig, 'prezzo_scontato': None, 'stockout': is_stockout}
    except Exception as e:
        print(f"Errore generico Callmewine: {e}")
        return {'prezzo_originale': None, 'prezzo_scontato': None, 'stockout': False}

def estrai_prezzo_xtrawine(url):
    is_stockout = False
    p_orig = None
    p_scont = None
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        is_stockout = check_stockout(soup)
            
        # Xtrawine: Prezzo originale e scontato
        # Cerca span con price-item price-item--regular
        orig_tag = soup.find('span', class_=re.compile(r'price-item--regular')) or cerca_prezzo_barrato(soup)
        # Cerca span con ht-money o price-item--sale
        sale_tag = soup.find('span', class_='notranslate ht-money') or soup.find('span', class_=re.compile(r'price-item--sale'))
        
        temp_orig = pulisci_prezzo(orig_tag.get_text() if orig_tag else None)
        temp_sale = pulisci_prezzo(sale_tag.get_text() if sale_tag else None)
        
        if temp_orig and temp_sale and temp_orig != temp_sale:
            p_orig = temp_orig
            p_scont = temp_sale
        else:
            p_orig = temp_sale or temp_orig
            
        return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}
    except Exception:
        return {'prezzo_originale': None, 'prezzo_scontato': None, 'stockout': False}

def estrai_prezzo_bernabei(url):
    is_stockout = False
    p_orig = None
    p_scont = None
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        is_stockout = check_stockout(soup)
            
        p_barrato = cerca_prezzo_barrato(soup)
        price_tag = soup.find('span', {'itemprop': 'price'})
        p_vendita = pulisci_prezzo(price_tag.get_text() if price_tag else None)
        
        if p_barrato and p_vendita:
            p_orig = p_barrato
            p_scont = p_vendita
        else:
            p_orig = p_vendita

        return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}
    except Exception:
        return {'prezzo_originale': None, 'prezzo_scontato': None, 'stockout': False}

def estrai_prezzo_vivino(url):
    """Estrae il prezzo da Vivino in modo ultra-sicuro (Bulletproof)."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://www.google.com/'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print(f"--- VIVINO BLINDATO (Status {response.status_code}) - Salto la riga ---")
            return {'prezzo_originale': None, 'prezzo_scontato': None, 'stockout': False}

        is_stockout = False
        p_orig = None
        p_scont = None
        
        # Check stockout
        if "non disponibile" in response.text.lower() or "esaurito" in response.text.lower():
            is_stockout = True
            
        soup = BeautifulSoup(response.text, 'html.parser')

        # Tentativo 1: JSON-LD
        try:
            script_tags = soup.find_all('script', type='application/ld+json')
            for tag in script_tags:
                if not tag.string: continue
                data = json.loads(tag.string)
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if 'offers' in item:
                        offers = item['offers']
                        if isinstance(offers, list): offers = offers[0]
                        if 'price' in offers:
                            p_orig = pulisci_prezzo(offers['price'])
                            if p_orig: break
                if p_orig: break
        except:
            pass

        # Tentativo 2: Regex Globale nel JSON di React (__PRELOADED_STATE__)
        if p_orig is None:
            match = re.search(r'"price":\s*\{"amount":\s*([\d\.]+)', response.text)
            if match:
                p_orig = pulisci_prezzo(match.group(1))

        # Tentativo 3: Classi HTML vecchie (Fallback)
        if p_orig is None:
            price_tag = soup.find('span', class_=re.compile('purchaseAvailability__currentPrice'))
            if price_tag:
                p_orig = pulisci_prezzo(price_tag.get_text())

        return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}

    except Exception as e:
        print(f"--- VIVINO BLINDATO (Errore di rete) - Salto la riga ---")
        return {'prezzo_originale': None, 'prezzo_scontato': None, 'stockout': False}

if __name__ == "__main__":
    # Carica il database locale dei vini
    try:
        df = pd.read_csv('database_vini.csv', sep=';')
    except Exception as e:
        print(f"Errore nel caricamento del database: {e}")
        exit()

    file_storico = 'storico_prezzi.csv'
    
    # Itera su tutte le righe del file
    for index, row in df.iterrows():
        sito = str(row['SITO_ECOMMERCE']).strip().lower()
        url = row['LINK']
        cantina = row['CANTINA']
        vino = row['VINO']
        
        print(f"Scraping {cantina} - {vino} su {row['SITO_ECOMMERCE']}...")
        
        try:
            dati = None
            if sito == 'tannico':
                dati = estrai_prezzo_tannico(url)
            elif sito == 'vino.com':
                dati = estrai_prezzo_vinocom(url)
            elif sito == 'callmewine':
                dati = estrai_prezzo_callmewine(url)
            elif sito == 'xtrawine':
                dati = estrai_prezzo_xtrawine(url)
            elif sito == 'bernabei':
                dati = estrai_prezzo_bernabei(url)
            elif sito == 'vivino':
                dati = estrai_prezzo_vivino(url)
            
            if dati and (dati['prezzo_originale'] is not None or dati['stockout']):
                p_orig = dati['prezzo_originale']
                p_scont = dati['prezzo_scontato']
                stock = "SI" if dati['stockout'] else "NO"
                
                # Visualizzazione console
                if dati['stockout']:
                    info = "OUT OF STOCK"
                    if p_orig: info += f" (Ultimo Prezzo: {p_orig}€)"
                else:
                    info = f"Prezzo: {p_orig}€"
                    if p_scont: info += f" | Scontato: {p_scont}€"
                
                print(f"-> {info}")
                
                # Salvataggio dati
                file_nuovo = not os.path.exists(file_storico) or os.path.getsize(file_storico) == 0
                
                with open(file_storico, mode='a', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    if file_nuovo:
                        writer.writerow(['DATA', 'CANTINA', 'VINO', 'SITO', 'PREZZO_RILEVATO', 'PREZZO_SCONTATO', 'STOCKOUT'])
                    
                    data_oggi = datetime.now().strftime('%Y-%m-%d %H:%M')
                    writer.writerow([data_oggi, cantina, vino, row['SITO_ECOMMERCE'], p_orig, p_scont, stock])
            else:
                print(f"-> Errore nell'estrazione dati per {url} (Sito: {row['SITO_ECOMMERCE']})")
                
        except Exception as e:
            print(f"-> Eccezione per {vino}: {e}")
