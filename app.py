import streamlit as st
import gspread
import json

st.title("🍷 La mia prima Dashboard Vinicola")

# INCOLLA QUI IL LINK DEL TUO FOGLIO GOOGLE
LINK_FOGLIO = "https://docs.google.com/spreadsheets/d/1mM998ELdz5WezKjdn93QgeO8IpA6JGIYeU-JtxflLmU/edit?gid=0#gid=0"

try:
    # IL CODICE INTELLIGENTE:
    if "google_credentials" in st.secrets:
        # 1A. Se siamo ONLINE, legge i segreti dal Cloud
        credenziali_segrete = json.loads(st.secrets["google_credentials"])
        gc = gspread.service_account_from_dict(credenziali_segrete)
    else:
        # 1B. Se siamo SUL TUO PC, legge il file locale
        gc = gspread.service_account(filename='credenziali.json')
    
    # 2. Punta dritto al file esatto tramite URL
    sh = gc.open_by_url(LINK_FOGLIO)
    worksheet = sh.sheet1

    # 3. Scrive nella cella usando la sintassi più stabile
    worksheet.update_acell('A1', 'Ciao Roberto, il bot è andato ONLINE!')

    # 4. Legge per conferma
    valore_letto = worksheet.acell('A1').value

    # 5. Mostra il risultato
    st.success("✅ Vittoria! Connessione a Google Sheets perfetta dal CLOUD!")
    st.metric(label="Il foglio dice:", value=valore_letto)

except Exception as e:
    st.error(f"❌ Errore: {e}")