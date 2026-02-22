import streamlit as st
import pandas as pd
import plotly.express as px
import gspread
import json

# --- 1. CONFIGURAZIONE PAGINA ---
st.set_page_config(page_title="Price Monitor | V1.0", layout="wide", initial_sidebar_state="expanded")

st.markdown("## :material/monitoring: Piattaforma di Price Intelligence")
st.caption("Monitoraggio multicanale e storico prezzi")
st.divider()

# --- 2. CONNESSIONE AL DATABASE REALE ---
LINK_FOGLIO = "https://docs.google.com/spreadsheets/d/1mM998ELdz5WezKjdn93QgeO8IpA6JGIYeU-JtxflLmU/edit?gid=490813682#gid=490813682"

@st.cache_data(ttl=600) # Cacha i dati per 10 minuti per non rallentare l'app
def carica_dati():
    try:
        # Gestione sicura per Streamlit Cloud e per il tuo PC locale
        if "google_credentials" in st.secrets:
            credenziali = json.loads(st.secrets["google_credentials"])
            gc = gspread.service_account_from_dict(credenziali)
        else:
            gc = gspread.service_account(filename='credenziali.json')
            
        sh = gc.open_by_url(LINK_FOGLIO)
        worksheet = sh.worksheet("Prezzi")
        dati = worksheet.get_all_records()
        
        # Convertiamo in DataFrame Pandas
        df = pd.DataFrame(dati)
        
        # Assicuriamoci che la data sia compresa correttamente da Python
        if not df.empty:
            df['Data'] = pd.to_datetime(df['Data'], format="%d/%m/%Y %H:%M")
            df['Prezzo'] = pd.to_numeric(df['Prezzo'])
            
        return df
    except Exception as e:
        st.error(f"Errore di connessione al database: {e}")
        return pd.DataFrame()

df = carica_dati()

if df.empty:
    st.warning("Il database è vuoto o non raggiungibile.")
else:
    # --- 3. FILTRO PRODOTTO (La barra laterale) ---
    st.sidebar.header("Impostazioni Analisi")
    lista_prodotti = df['Prodotto'].unique().tolist()
    prodotto_selezionato = st.sidebar.selectbox("🎯 Seleziona il Prodotto:", lista_prodotti)
    
    # Filtriamo il database SOLO per il prodotto scelto
    df_filtrato = df[df['Prodotto'] == prodotto_selezionato].copy()
    
    # --- 4. SEZIONE: ULTIMO PREZZO RILEVATO ---
    st.subheader(f"Ultimo Prezzo Rilevato")
    st.write(f"**{prodotto_selezionato}**")
    
    # Troviamo l'ultimo dato in ordine cronologico per ogni sito
    df_ultimi_prezzi = df_filtrato.sort_values('Data').groupby('Sito').tail(1)
    
    # Creiamo le "Card" in modo dinamico a seconda di quanti siti abbiamo
    colonne_metriche = st.columns(len(df_ultimi_prezzi))
    
    for indice, (index, riga) in enumerate(df_ultimi_prezzi.iterrows()):
        con_colonna = colonne_metriche[indice]
        data_formattata = riga['Data'].strftime("%d/%m %H:%M")
        con_colonna.metric(
            label=f"🏢 {riga['Sito']}", 
            value=f"{riga['Prezzo']:.2f} €", 
            delta=f"Aggiornato il {data_formattata}",
            delta_color="off"
        )

    st.divider()

    # --- 5. SEZIONE: ANDAMENTO STORICO (GRAFICO A LINEE) ---
    st.subheader("📈 Andamento Storico del Prezzo")
    
    # Se abbiamo solo un dato temporale, il grafico a linee è solo un punto.
    # Gestiamo l'avviso per il cliente.
    if len(df_filtrato['Data'].unique()) < 2:
        st.info("💡 Il grafico storico si popolerà automaticamente non appena il bot raccoglierà dati in giorni diversi.")
    
    # Disegniamo il grafico
    fig = px.line(
        df_filtrato, 
        x="Data", 
        y="Prezzo", 
        color="Sito", 
        markers=True, # Aggiunge i pallini sui punti dati
        title="Fluttuazione Prezzi nel Tempo",
        labels={"Data": "Data di Rilevazione", "Prezzo": "Prezzo di Vendita (€)"},
        template="plotly_white" # Design pulito
    )
    
    # Formattazione asse Y per mostrare l'Euro
    fig.update_layout(yaxis_tickformat='.2f')
    
    st.plotly_chart(fig, use_container_width=True)
    
    # --- ESPANDIBILE: DATI GREZZI (Opzionale) ---
    with st.expander("👁️ Vedi tutti i dati grezzi estratti"):
        st.dataframe(df_filtrato.sort_values('Data', ascending=False))