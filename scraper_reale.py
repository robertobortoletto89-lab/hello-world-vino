import requests
from bs4 import BeautifulSoup
import gspread
from datetime import datetime
import re

# 1. SETUP DEL DATABASE
LINK_FOGLIO = "https://docs.google.com/spreadsheets/d/1mM998ELdz5WezKjdn93QgeO8IpA6JGIYeU-JtxflLmU/edit?gid=490813682#gid=490813682" 

# 2. DIZIONARIO BERSAGLI
siti_target = [
    {
        "nome_sito": "Tannico",
        "url": "https://www.tannico.it/products/valdobbiadene-prosecco-superiore-docg-millesimato-2024-brut-villa-sandi/?variant=51755338662228",
        "tag_prezzo": "span",
        "attributi": {"data-price-target": "price"},
        "usa_content": False
    },
    {
        "nome_sito": "Spirit Italia",
        "url": "https://spirit-italia.com/Villa-Sandi-Millesimato-Valdobbiadene-Prosecco-Superiore-Brut-DOCG-2024-11-Vol-075l_1",
        "tag_prezzo": "meta",
        "attributi": {"itemprop": "price"},
        "usa_content": True
    },
    {
        "nome_sito": "Land of Wines",
        "url": "https://landofwines.com/vini/valdobbiadene-prosecco-sup-docg-millesimato-brut-2024-villa-sandi/",
        "tag_prezzo": "bdi",
        "attributi": {},
        "usa_content": False
    }
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# --- MODIFICA 1: Aggiunta dell'ID univoco ---
id_prodotto_ufficiale = "WINE-001" # Sostituisci questo con il VERO ID che hai scelto
nome_prodotto_ufficiale = "Prosecco Valdobbiadene DOCG Millesimato 2024 Brut - Villa Sandi"
# --------------------------------------------

dati_estratti = []
data_oggi = datetime.now().strftime("%d/%m/%Y %H:%M")

print(f"🕵️ Avvio scansione multicanale per: [{id_prodotto_ufficiale}] {nome_prodotto_ufficiale}")

# 3. IL MOTORE DI ESTRAZIONE INTELLIGENTE
for sito in siti_target:
    print(f"\nBussando a {sito['nome_sito']}...")
    try:
        risposta = requests.get(sito['url'], headers=headers, timeout=10)
        
        if risposta.status_code == 200:
            zuppa = BeautifulSoup(risposta.text, "html.parser")
            
            elemento_prezzo = zuppa.find(sito['tag_prezzo'], attrs=sito['attributi'])
                
            if elemento_prezzo:
                if sito['usa_content']:
                    testo_prezzo = elemento_prezzo.get('content', '')
                else:
                    testo_prezzo = elemento_prezzo.text
                
                testo_prezzo = testo_prezzo.replace('€', '').replace(',', '.').strip()
                match = re.search(r'\d+\.\d+', testo_prezzo)
                
                if match:
                    prezzo_pulito = float(match.group())
                    print(f"✅ Prezzo Trovato: {prezzo_pulito} €")
                    
                    # --- MODIFICA 2: Aggiunta dell'ID nella riga da salvare ---
                    # Ho inserito l'ID subito dopo la data
                    dati_estratti.append([data_oggi, id_prodotto_ufficiale, nome_prodotto_ufficiale, sito['nome_sito'], prezzo_pulito, sito['url']])
                    # ----------------------------------------------------------
                else:
                    print(f"⚠️ Prezzo trovato ma non leggibile: {testo_prezzo}")
            else:
                print(f"⚠️ Accesso ok, ma l'elemento HTML non è stato trovato.")
        else:
            print(f"❌ Accesso bloccato (Codice {risposta.status_code}).")
            
    except Exception as e:
        print(f"❌ Errore tecnico: {e}")

# 4. SALVATAGGIO SUL DATABASE
if dati_estratti:
    print("\n☁️ Scrittura su Google Sheets in corso...")
    try:
        gc = gspread.service_account(filename='credenziali.json')
        sh = gc.open_by_url(LINK_FOGLIO)
        worksheet = sh.worksheet("Prezzi")
        
        for riga in dati_estratti:
            worksheet.append_row(riga)
            
        print("🎉 MISSIONE COMPIUTA! Tutti i prezzi sono salvati.")
    except Exception as e:
        print(f"❌ Errore nel salvataggio su Google Sheets: {e}")
else:
    print("\n⚠️ Nessun dato utile estratto oggi. Database non aggiornato.")