import requests
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime
import re
import json
import os
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
}

DIR_SCREENSHOTS = os.path.join('public', 'screenshots')
if not os.path.exists(DIR_SCREENSHOTS):
    os.makedirs(DIR_SCREENSHOTS, exist_ok=True)

def pulisci_prezzo(testo):
    if not testo: return None
    try:
        pulito = str(testo).replace('€', '').replace('\xa0', '').strip()
        pulito = re.sub(r'[^\d,.-]', '', pulito).replace(',', '.')
        return float(pulito)
    except:
        return None

# --- ESTRATTORI ORIGINALI PRESERVATI ---
def estrai_tannico(soup):
    is_stockout = False
    if soup and soup.text:
        is_stockout = "non disponibile" in soup.text.lower()
    p_orig, p_scont = None, None
    try:
        scripts = soup.find_all('script', type='application/ld+json')
        for script in scripts:
            if script.string and 'price' in script.string.lower():
                match_price = re.search(r'"price":\s*"?(\d+[.,]?\d*)"?', script.string)
                if match_price:
                    p_orig = float(match_price.group(1).replace(',', '.'))
                    break
    except Exception: pass

    if not p_orig:
        try:
            prezzo_tag = soup.find(attrs={"itemprop": "price"})
            if prezzo_tag: p_orig = pulisci_prezzo(prezzo_tag.get('content') or prezzo_tag.text)
        except Exception: pass

    if not p_orig:
        try:
            contenitore = soup.find('div', {'data-controller': 'price'}) or soup.find('div', class_=re.compile('price', re.I))
            if contenitore:
                scont_tag = contenitore.find('span', class_=re.compile('tw-text-blue|tw-text-red|discount'))
                orig_tag = contenitore.find('span', class_=re.compile('tw-line-through|original'))
                if scont_tag:
                    p_scont = pulisci_prezzo(scont_tag.text)
                    p_orig = pulisci_prezzo(orig_tag.text) if orig_tag else p_scont
                else:
                    base_tag = contenitore.find('span', class_=re.compile('tw-font-bold|current'))
                    p_orig = pulisci_prezzo(base_tag.text) if base_tag else None
        except Exception: pass
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
        except: continue
    return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}

def estrai_vinocom(soup):
    is_stockout = False
    if soup and soup.text:
        is_stockout = "non disponibile" in soup.text.lower()
    p_orig, p_scont = None, None
    tag_prezzo = soup.find(itemprop='price')
    if tag_prezzo: p_orig = pulisci_prezzo(tag_prezzo.get('content') or tag_prezzo.text)
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
    if tag_prezzo: p_orig = pulisci_prezzo(tag_prezzo.text)
    return {'prezzo_originale': p_orig, 'prezzo_scontato': p_scont, 'stockout': is_stockout}


# --- NUOVA FUNZIONE: STRATEGIA 2 - SCATTO E TIMBRO DIGITALE (AUDIT TRAIL) ---
def cattura_e_timbri_screenshot(url, id_prodotto, motivo):
    print(f"📸 [TRIGGER: {motivo}] Avvio Playwright per prova fotografica...")
    timestamp_file = datetime.now().strftime('%Y%m%d_%H%M%S')
    nome_file = f"{id_prodotto}_{timestamp_file}.webp"
    percorso_salvataggio = os.path.join(DIR_SCREENSHOTS, nome_file)
    percorso_temporaneo = os.path.join(DIR_SCREENSHOTS, f"temp_{id_prodotto}.png")

    try:
        # 1. Scatto dello screenshot pulito (Upper Viewport per massima stabilità tra i siti)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_viewport_size({"width": 1280, "height": 800})
            page.goto(url, timeout=30000, wait_until="networkidle")
            page.wait_for_timeout(2000) # Attesa stabilizzazione elementi
            page.screenshot(path=percorso_temporaneo)
            browser.close()

        # 2. Applicazione del Timbro Digitale con Pillow (Metodo 2)
        img = Image.open(percorso_temporaneo)
        draw = ImageDraw.Draw(img)
        
        # Prepariamo i testi dell'Audit Trail
        testo_data = f"DATA/ORA: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}"
        testo_url = f"URL: {url[:80]}..." if len(url) > 80 else f"URL: {url}"
        testo_motivo = f"NOTIFICA: VIOLAZIONE COMMERCIALE [{motivo}]"

        # Creazione della fascia nera di overlay in basso ad alto contrasto
        larghezza, altezza = img.size
        altezza_fascia = 90
        draw.rectangle([(0, altezza - altezza_fascia), (larghezza, altezza)], fill=(0, 0, 0))

        # Scrittura testi (usa font di default se i ttf di sistema non sono pronti)
        try:
            font = ImageFont.load_default()
        except:
            font = None

        draw.text((20, altezza - 80), testo_data, fill=(255, 255, 255), font=font)
        draw.text((20, altezza - 55), testo_url, fill=(255, 255, 0), font=font) # Giallo per evidenziare il link
        draw.text((20, altezza - 30), testo_motivo, fill=(255, 100, 100), font=font) # Rosso per il motivo

        # 3. Compressione drastica e salvataggio in WebP (Ottimizzazione pesi)
        img.save(percorso_salvataggio, "WEBP", quality=75)
        
        # Pulizia file temporaneo pesante
        if os.path.exists(percorso_temporaneo):
            os.remove(percorso_temporaneo)
            
        print(f"✅ Screenshot timbrato e salvato (WebP): /screenshots/{nome_file}")
        return f"/screenshots/{nome_file}"

    except Exception as e:
        print(f"❌ Errore durante la cattura dello screenshot: {e}")
        if os.path.exists(percorso_temporaneo): os.remove(percorso_temporaneo)
        return None


def avvia_scraping():
    FILE_INPUT = 'database_vini.csv' 
    FILE_OUTPUT = 'storico_prezzi.csv'
    
    if not os.path.exists(FILE_INPUT):
        print(f"Errore: File {FILE_INPUT} non trovato!")
        return

    try:
        df_input = pd.read_csv(FILE_INPUT, sep=',', encoding='utf-8-sig', engine='python')
        df_input.columns = df_input.columns.str.strip().str.upper()
        if 'LINK_SCRAPING' not in df_input.columns:
            df_input = pd.read_csv(FILE_INPUT, sep=';', encoding='utf-8-sig', engine='python')
            df_input.columns = df_input.columns.str.strip().str.upper()
    except Exception as e:
        print(f"❌ Errore critico lettura anagrafica: {e}")
        raise e

    risultati = []
    oggi = datetime.now().strftime('%d/%m/%Y')

    for index, row in df_input.iterrows():
        url = str(row.get('LINK_SCRAPING', '')).strip() 
        id_prodotto = str(row.get('ID_PRODOTTO', '')).strip()
        cantina = str(row.get('CANTINA', 'Sconosciuta')).strip()
        nome_prodotto = str(row.get('NOME_PRODOTTO', 'Sconosciuto')).strip()
        sito_origine = str(row.get('SITO_ORIGINE', '')).strip().lower()
        
        # Lettura del prezzo base impostato dall'utente
        prezzo_base = row.get('PREZZO_BASE')
        try:
            prezzo_base = float(str(prezzo_base).replace(',', '.')) if pd.notna(prezzo_base) else None
        except:
            prezzo_base = None
        
        if not url or url.lower() == 'nan': continue
            
        print(f"Scraping standard: {cantina} - {nome_prodotto} su {sito_origine}...")
        dati = {'prezzo_originale': None, 'prezzo_scontato': None, 'stockout': False}
        
        # 1. Controllo testuale super veloce (BS4 + Requests)
        try:
            response = requests.get(url, headers=HEADERS, timeout=15)
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                if 'tannico' in sito_origine: dati = estrai_tannico(soup)
                elif 'callmewine' in sito_origine: dati = estrai_callmewine(soup)
                elif 'vino.com' in sito_origine: dati = estrai_vinocom(soup)
                elif 'xtrawine' in sito_origine: dati = estrai_xtrawine(soup)
                elif 'bernabei' in sito_origine: dati = estrai_bernabei(soup)
        except Exception: pass

        # 2. LOGICA CONTROLLO TRIGGER PER LO SCREENSHOT
        screenshot_path = None
        trigger_reason = None
        
        prezzo_finale = dati['prezzo_scontato'] if dati['prezzo_scontato'] else dati['prezzo_originale']

        if dati['stockout']:
            trigger_reason = "STOCKOUT"
        elif prezzo_finale and prezzo_base and (prezzo_finale < prezzo_base):
            trigger_reason = "SOTTO_PREZZO"
        elif dati['prezzo_scontato'] is not None:
            trigger_reason = "SCONTO_RILEVATO"

        # Se uno dei tre casi si è avverato, scatta la foto
        if trigger_reason:
            screenshot_path = cattura_e_timbri_screenshot(url, id_prodotto, trigger_reason)

        record = {
            'DATA_ESTRAZIONE': oggi,
            'CANTINA': cantina,
            'ID_PRODOTTO': id_prodotto,
            'NOME_PRODOTTO': nome_prodotto,
            'SITO_ORIGINE': sito_origine.capitalize(),
            'PREZZO_RILEVATO': dati['prezzo_originale'],
            'PREZZO_SCONTATO': dati['prezzo_scontato'],
            'STOCKOUT': 'SI' if dati['stockout'] else 'NO',
            'LINK_SCRAPING': url,
            'TRIGGER_REASON': trigger_reason if trigger_reason else 'REGOLARE',
            'SCREENSHOT_PATH': screenshot_path if screenshot_path else ''
        }
        risultati.append(record)

    # 3. SALVATAGGIO E UNIONE STORICO
    if risultati:
        df_nuovi = pd.DataFrame(risultati)
        ordine_colonne = ['DATA_ESTRAZIONE', 'ID_PRODOTTO', 'CANTINA', 'NOME_PRODOTTO', 'SITO_ORIGINE', 'PREZZO_RILEVATO', 'PREZZO_SCONTATO', 'STOCKOUT', 'TRIGGER_REASON', 'SCREENSHOT_PATH', 'LINK_SCRAPING']
        
        if os.path.exists(FILE_OUTPUT):
            try:
                df_storico = pd.read_csv(FILE_OUTPUT, sep=';', encoding='utf-8-sig', engine='python')
                df_storico.columns = df_storico.columns.str.strip().str.upper()
                df_finale = pd.concat([df_storico, df_nuovi], ignore_index=True)
            except Exception:
                df_finale = df_nuovi
        else:
            df_finale = df_nuovi
            
        for col in ordine_colonne:
            if col not in df_finale.columns: df_finale[col] = ''
        
        df_finale = df_finale[ordine_colonne]
        df_finale.to_csv(FILE_OUTPUT, sep=';', encoding='utf-8-sig', index=False)
        print("✅ Database storico prezzi aggiornato con colonne di Audit Trail Fotografico.")

if __name__ == "__main__":
    avvia_scraping()