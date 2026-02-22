import requests
from bs4 import BeautifulSoup
import gspread
from datetime import datetime

# --- 1. VARIABILI DA PERSONALIZZARE ---
LINK_FOGLIO = "https://docs.google.com/spreadsheets/d/1mM998ELdz5WezKjdn93QgeO8IpA6JGIYeU-JtxflLmU/edit?gid=490813682#gid=490813682" # <-- Metti il link del tuo Google Sheet!
url_vino = "https://www.callmewine.com/franciacorta-extra-brut-alma-assemblage-1-bellavista-375cl-P63055.htm"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# --- 2. FASE DI ESTRAZIONE (Web Scraping) ---
print("🕵️ Avvio il bot esploratore...")
try:
    risposta = requests.get(url_vino, headers=headers)
    
    if risposta.status_code == 200:
        zuppa = BeautifulSoup(risposta.text, "html.parser")
        elemento_prezzo = zuppa.find("span", class_="c-finalPrice")
        elemento_titolo = zuppa.find("h1") 
        
        if elemento_prezzo and elemento_titolo:
            # Puliamo i dati estratti
            prezzo_estratto = elemento_prezzo.text.replace('\n', '').strip()
            vero_nome = elemento_titolo.text.strip()
            
            # Calcoliamo la data e l'ora di questo esatto momento
            data_oggi = datetime.now().strftime("%d/%m/%Y %H:%M")
            
            print(f"✅ Trovato: {vero_nome} a {prezzo_estratto}")
            
            # --- 3. FASE DI SALVATAGGIO (Google Sheets) ---
            print("☁️ Connessione al database Google Sheets in corso...")
            
            # Usa il tuo file credenziali.json per farsi aprire la porta da Google
            gc = gspread.service_account(filename='credenziali.json')
            sh = gc.open_by_url(LINK_FOGLIO)
            worksheet = sh.worksheet("Prezzi") # Puntiamo al foglio nuovo
            
            # Scriviamo una nuova riga con i 4 dati in ordine!
            worksheet.append_row([data_oggi, vero_nome, prezzo_estratto, url_vino])
            
            print("🎉 MISSIONE COMPIUTA! I dati sono stati scritti sul tuo Google Sheet.")
            
        else:
            print("⚠️ Accesso ok, ma mancano prezzo o titolo sulla pagina.")
            
    else:
        print(f"❌ Accesso negato dal sito. Codice: {risposta.status_code}")

except Exception as e:
    print(f"❌ Si è verificato un errore: {e}")