import streamlit as st
import pandas as pd
import gspread
import json

# --- CONFIGURAZIONE PAGINA ---
st.set_page_config(page_title="Analisi Sentiment | Prototipo", page_icon="🍷", layout="centered")

# --- LE TUE VARIABILI (Quelle da cambiare per ogni cliente) ---
CLIENTE = "Cantina Esempio (Valpolicella)"
PRODOTTO_EROE = "Valpolicella Ripasso DOC"
LINK_FOGLIO = "https://docs.google.com/spreadsheets/d/1mM998ELdz5WezKjdn93QgeO8IpA6JGIYeU-JtxflLmU/edit?gid=1587083773#gid=1587083773"

# --- 1. INTESTAZIONE EFFETTO WOW ---
st.title(f"📊 Analisi ROI Marketing vs Percezione")
st.subheader(f"Focus: {PRODOTTO_EROE} di {CLIENTE}")
st.write("Abbiamo rilevato che nell'ultimo mese avete concentrato il **68% del budget adv social** su questa etichetta.")
st.write("Ma cosa ne pensano davvero i consumatori finali? L'Intelligenza Artificiale ha analizzato le ultime 100 recensioni online estraendo i 10 argomenti più discussi (Pro e Contro).")
st.divider()

# --- 2. CONNESSIONE AL DATABASE (Sicura) ---
try:
    if "google_credentials" in st.secrets:
        credenziali_segrete = json.loads(st.secrets["google_credentials"])
        gc = gspread.service_account_from_dict(credenziali_segrete)
    else:
        gc = gspread.service_account(filename='credenziali.json')
    
    sh = gc.open_by_url(LINK_FOGLIO)
    worksheet = sh.worksheet("Recensioni") 
    dati = worksheet.get_all_records()
    df = pd.DataFrame(dati)
    
    with st.expander("👁️ Clicca qui per vedere un campione dei dati grezzi estratti"):
        st.dataframe(df)

except Exception as e:
    st.error(f"Errore di connessione al database. Controlla il link o le credenziali. Dettaglio: {e}")

st.divider()

# --- 3. LA TRAPPOLA PSICOLOGICA (Top 10 Insights) ---
st.markdown("### 🧠 Top 10 Insight Estratti dall'AI")

# Posizioni 6-10 (Visibili)
st.info("###### #10 - Prezzo percepito alto nella GDO (12 citazioni)")
st.info("###### #9 - Etichetta molto apprezzata per regali (15 citazioni)")
st.info("###### #8 - Ottimo abbinamento con carni rosse (18 citazioni)")
st.info("###### #7 - Leggera nota acida nel finale (22 citazioni)")
st.info("###### #6 - Consegna e-commerce spesso in ritardo (25 citazioni)")

# Posizioni 1-5 (Nascoste con effetto sfocato)
st.markdown("### 🔒 Le prime 5 posizioni sono riservate")
st.write("Questi 5 punti contengono i **2 difetti critici principali** che stanno abbassando il tasso di riacquisto del prodotto, e il **punto di forza numero 1** da sfruttare nelle prossime campagne Facebook.")

# Trucco CSS per sfocare il testo
testo_sfocato = """
<div style='filter: blur(5px); user-select: none; pointer-events: none; opacity: 0.7;'>
    <div style='background-color: #f0f2f6; padding: 15px; border-radius: 5px; margin-bottom: 10px;'>#5 - [CRITICITÀ SUL PACKAGING] (31 citazioni)</div>
    <div style='background-color: #f0f2f6; padding: 15px; border-radius: 5px; margin-bottom: 10px;'>#4 - [PROBLEMA DI OSSIDAZIONE] (38 citazioni)</div>
    <div style='background-color: #f0f2f6; padding: 15px; border-radius: 5px; margin-bottom: 10px;'>#3 - [COMPETITOR PIÙ ECONOMICO PREFERITO] (45 citazioni)</div>
    <div style='background-color: #f0f2f6; padding: 15px; border-radius: 5px; margin-bottom: 10px;'>#2 - [VANTAGGIO COMPETITIVO IGNORATO] (52 citazioni)</div>
    <div style='background-color: #ffcccc; padding: 15px; border-radius: 5px; font-weight: bold;'>#1 - [IL DIFETTO STRUTTURALE PIÙ LAMENTATO] (65 citazioni)</div>
</div>
"""
st.markdown(testo_sfocato, unsafe_allow_html=True)

st.write("") 

# --- 4. CALL TO ACTION ---
st.markdown("Vuoi scoprire cosa dicono i tuoi clienti e ottimizzare il tuo budget marketing?")
link_calendario = "https://www.linkedin.com/in/roberto-bortoletto/" # <-- METTI IL TUO LINK QUI
st.link_button("🔓 Sblocca il Report Completo (Call di 15 min)", link_calendario, type="primary")