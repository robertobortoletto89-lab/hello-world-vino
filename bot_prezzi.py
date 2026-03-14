import requests
from bs4 import BeautifulSoup
import json
import re
import csv
import os
from datetime import datetime

def estrai_prezzo_tannico(url):
    """
    Estrae il prezzo di un prodotto da Tannico.it utilizzando tecniche di scraping
    per eludere i blocchi anti-bot e puntando ai dati strutturati.
    """
    
    # Travestimento Anti-Bot: User-Agent realistico
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.google.com/'
    }
    
    try:
        # Esecuzione della richiesta GET
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status() # Verifica se la pagina è stata trovata (status 200)
        
        soup = BeautifulSoup(response.text, 'html.parser')
        prezzo_grezzo = None

        # 1. Ricerca nei Dati Strutturati (JSON-LD) - Priorità massima
        scripts = soup.find_all('script', type='application/ld+json')
        for script in scripts:
            try:
                # Carichiamo il contenuto JSON dello script
                if not script.string:
                    continue
                data = json.loads(script.string)
                
                # Il JSON-LD può essere un singolo oggetto o una lista (@graph)
                items = data if isinstance(data, list) else [data]
                
                for item in items:
                    # Cerchiamo la chiave 'offers' che contiene il prezzo
                    if 'offers' in item:
                        offers = item['offers']
                        if isinstance(offers, dict):
                            prezzo_grezzo = offers.get('price')
                        elif isinstance(offers, list) and len(offers) > 0:
                            prezzo_grezzo = offers[0].get('price')
                    
                    # Se non è in offers, cerchiamo direttamente price nel tag
                    if not prezzo_grezzo and 'price' in item:
                        prezzo_grezzo = item['price']
                        
                    if prezzo_grezzo: break
                if prezzo_grezzo: break
            except (json.JSONDecodeError, TypeError, KeyError):
                continue

        # 2. Ricerca nel tag <meta itemprop="price"> - Alternativa
        if not prezzo_grezzo:
            meta_price = soup.find('meta', {'itemprop': 'price'})
            if meta_price:
                prezzo_grezzo = meta_price.get('content')

        # 3. Ricerca via classi CSS tipiche - Fallback
        if not prezzo_grezzo:
            # Tannico usa spesso 'price' o attributi data-price
            selettori = ['.price', '.current-price', '.product-price', '[data-price]']
            for sel in selettori:
                tag = soup.select_one(sel)
                if tag:
                    prezzo_grezzo = tag.get_text()
                    break

        # Pulizia e conversione del dato
        if prezzo_grezzo:
            # Trasformiamo in stringa per sicurezza
            prezzo_str = str(prezzo_grezzo).strip()
            
            # Rimuoviamo il simbolo dell'euro e altri caratteri non numerici tranne virgola e punto
            prezzo_str = re.sub(r'[^\d,.]', '', prezzo_str)
            
            # Logica richiesta: gestiamo la punteggiatura per la conversione float
            # Spesso il prezzo arriva come "12,50" o "12.50"
            if ',' in prezzo_str and '.' in prezzo_str:
                # Caso es. 1.250,50 -> rimuoviamo il punto delle migliaia
                prezzo_str = prezzo_str.replace('.', '').replace(',', '.')
            elif ',' in prezzo_str:
                # Caso es. 12,50 -> convertiamo virgola in punto
                prezzo_str = prezzo_str.replace(',', '.')
            
            # Conversione finale a float
            return float(prezzo_str)
        else:
            raise ValueError("Prezzo non individuato nella struttura della pagina.")

    except Exception as e:
        print(f"Errore critico durante lo scraping: {e}")
        return None

if __name__ == "__main__":
    import pandas as pd

    # Carica il database locale dei vini
    df = pd.read_csv('database_vini.csv', sep=';')

    # Itera su tutte le righe del file
    for index, row in df.iterrows():
        # Controllo case-insensitive per il sito e-commerce "Tannico"
        if str(row['SITO_ECOMMERCE']).strip().lower() == 'tannico':
            url = row['LINK']
            try:
                # Estrazione del prezzo
                prezzo = estrai_prezzo_tannico(url)
                
                if prezzo is not None:
                    # Formatta il prezzo con la virgola (es. 12,50)
                    prezzo_formattato = f"{prezzo:.2f}".replace('.', ',')
                    print(f"{row['CANTINA']} - {row['VINO']} su {row['SITO_ECOMMERCE']}: {prezzo_formattato} €")
                    
                    # Salva il dato nello storico (CSV)
                    file_storico = 'storico_prezzi.csv'
                    file_nuovo = not os.path.exists(file_storico) or os.path.getsize(file_storico) == 0
                    
                    with open(file_storico, mode='a', newline='', encoding='utf-8') as f:
                        writer = csv.writer(f)
                        if file_nuovo:
                            writer.writerow(['Data', 'Cantina', 'Vino', 'Sito', 'Prezzo'])
                        
                        data_oggi = datetime.now().strftime('%Y-%m-%d')
                        writer.writerow([data_oggi, row['CANTINA'], row['VINO'], row['SITO_ECOMMERCE'], prezzo])
                else:
                    # Se non è possibile estrarre il prezzo
                    print(f"{row['CANTINA']} - {row['VINO']} su {row['SITO_ECOMMERCE']}: Prezzo non disponibile.")
            except Exception as e:
                # Gestione errore specifica per la riga affinché il loop continui
                print(f"Errore nell'estrazione per {row['VINO']}: {e}")
