import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import gspread
import json
from datetime import datetime

# --- CONFIGURAZIONE PAGINA ---
st.set_page_config(
    page_title="Villa Sandi | Price Intelligence",
    page_icon="🍷",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- STILE CUSTOM (Corporate Villa Sandi) ---
st.markdown("""
    <style>
    .main {
        background-color: #f9f9f9;
    }
    .stMetric {
        background-color: #ffffff;
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    h1, h2, h3 {
        color: #8b0000 !important;
    }
    .stTabs [data-baseweb="tab-list"] button [data-testid="stMarkdownContainer"] p {
        font-size: 1.1rem;
        font-weight: 600;
    }
    </style>
    """, unsafe_allow_html=True)

# --- COSTANTI ---
COLOR_CORPORATE = "#8b0000"
LINK_FOGLIO = "https://docs.google.com/spreadsheets/d/1mM998ELdz5WezKjdn93QgeO8IpA6JGIYeU-JtxflLmU/edit?gid=490813682#gid=490813682"

# --- FUNZIONI MODULARI ---

@st.cache_data(ttl=600)
def carica_dati():
    """Carica i dati da Google Sheets o mock se fallisce."""
    try:
        if "google_credentials" in st.secrets:
            credenziali = json.loads(st.secrets["google_credentials"])
            gc = gspread.service_account_from_dict(credenziali)
        else:
            gc = gspread.service_account(filename='credenziali.json')
            
        sh = gc.open_by_url(LINK_FOGLIO)
        worksheet = sh.worksheet("Prezzi")
        df = pd.DataFrame(worksheet.get_all_records())
        
        # Pulizia dati
        if not df.empty:
            # Assicuriamoci che le colonne esistano
            df = df[df['Prodotto'].astype(str).str.strip() != '']
            df['Data'] = pd.to_datetime(df['Data'], format="%d/%m/%Y %H:%M", errors='coerce')
            
            # Conversione prezzi (gestione virgola/punto)
            for col in ['Prezzo', 'Prezzo_Base']:
                if col in df.columns:
                    df[col] = df[col].astype(str).str.replace('€', '', regex=False)
                    df[col] = df[col].str.replace(',', '.', regex=False).str.strip()
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            return df
    except Exception as e:
        st.error(f"Errore caricamento dati: {e}")
        return pd.DataFrame()

def format_euro(valore):
    """Formatta i numeri in formato europeo (1.234,56 €)."""
    if pd.isna(valore): return "N/D"
    return f"{valore:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") + " €"

# --- LOGICA APPLICATIVA ---

def main():
    # Intestazione Corporate
    st.markdown(f"# :material/monitoring: Price Intelligence Analysis for Villa Sandi")
    st.caption("Piattaforma B2B di Monitoraggio e Sentiment Analysis")
    
    df_raw = carica_dati()
    
    if df_raw.empty:
        st.warning("In attesa di dati dal database...")
        return

    # --- SIDEBAR FILTRI ---
    st.sidebar.header("Filtri di Analisi")
    
    prodotti = sorted(df_raw['Prodotto'].unique())
    prodotto_scelto = st.sidebar.selectbox("🎯 Seleziona Prodotto", prodotti)
    
    # Filtro Date
    min_date = df_raw['Data'].min().date() if not df_raw['Data'].isnull().all() else datetime.now().date()
    max_date = df_raw['Data'].max().date() if not df_raw['Data'].isnull().all() else datetime.now().date()
    
    date_range = st.sidebar.date_input(
        "📅 Periodo di Analisi",
        value=(min_date, max_date),
        min_value=min_date,
        max_value=max_date,
        format="DD/MM/YYYY"
    )

    # Applicazione Filtri
    df_f = df_raw[df_raw['Prodotto'] == prodotto_scelto].copy()
    if len(date_range) == 2:
        df_f = df_f[(df_f['Data'].dt.date >= date_range[0]) & (df_f['Data'].dt.date <= date_range[1])]

    if df_f.empty:
        st.info("Nessun dato disponibile per i filtri selezionati.")
        return

    # --- SEZIONE TOP (Ancoraggio Visivo) ---
    ultimo_dato = df_f.sort_values('Data').iloc[-1]
    
    col_img, col_info = st.columns([1, 3])
    
    with col_img:
        img_url = ultimo_dato.get('Immagine_URL', '')
        if img_url:
            st.image(img_url, width=200)
        else:
            st.info("Immagine non disponibile")
            
    with col_info:
        st.subheader(prodotto_scelto)
        st.write(f"**Descrizione:** {ultimo_dato.get('Descrizione', 'N/D')}")
        c1, c2, c3 = st.columns(3)
        c1.metric("Prezzo Listino (Base)", format_euro(ultimo_dato.get('Prezzo_Base', 0)))
        c2.metric("Ultima Rilevazione", ultimo_dato['Data'].strftime("%d/%m/%Y"))
        c3.write(f"**Formato:** Standard 750ml") # Esempio, se non in DB
        
    st.divider()

    # --- TABS ---
    tab1, tab2 = st.tabs([":material/payments: Price Intelligence", ":material/forum: Sentiment Analysis"])

    with tab1:
        # 1. Grafico Principale
        st.subheader("Andamento Prezzi vs Listino")
        
        fig = px.line(
            df_f, x="Data", y="Prezzo", color="Sito",
            markers=True, line_shape="linear",
            color_discrete_sequence=px.colors.qualitative.Prism
        )
        
        # Linea Prezzo Base
        prezzo_base = ultimo_dato.get('Prezzo_Base', 0)
        fig.add_hline(
            y=prezzo_base, 
            line_dash="dash", 
            line_color="black", 
            annotation_text="Prezzo Base", 
            annotation_position="top left"
        )
        
        fig.update_layout(
            hovermode="x unified",
            yaxis_title="Prezzo (€)",
            xaxis_title="Data Rilevazione",
            legend_title="Marketplace",
            template="plotly_white"
        )
        st.plotly_chart(fig, use_container_width=True)

        # 2. KPI Devianza
        col_kpi1, col_kpi2 = st.columns([1, 2])
        
        with col_kpi1:
            totale_rilevazioni = len(df_f)
            sottocosto = len(df_f[df_f['Prezzo'] < df_f['Prezzo_Base']])
            perc_sottocosto = (sottocosto / totale_rilevazioni * 100) if totale_rilevazioni > 0 else 0
            
            st.metric(
                label="Devianza Sottocosto", 
                value=f"{perc_sottocosto:.1f}%",
                delta=f"{sottocosto} su {totale_rilevazioni} rilevazioni",
                delta_color="inverse"
            )
            st.caption(f"Percentuale di rilevazioni con prezzo inferiore a {format_euro(prezzo_base)}")

        with col_kpi2:
            # 3. Wall of Shame
            st.markdown("#### 🚩 Wall of Shame (Top Price Violators)")
            
            # Calcolo % sottocosto per sito
            wos = df_f.groupby('Sito').apply(
                lambda x: (x['Prezzo'] < x['Prezzo_Base']).mean() * 100
            ).reset_index()
            wos.columns = ['Sito', '% Sottocosto']
            wos = wos.sort_values('% Sottocosto', ascending=False)
            
            st.table(wos.style.format({'% Sottocosto': '{:.1f}%'}))

    with tab2:
        st.subheader("Customer Sentiment Analysis")
        st.info("Analisi basata su recensioni estratte da marketplace e social media.")
        
        col_s1, col_s2, col_s3 = st.columns(3)
        col_s1.metric("Totale Recensioni", "1.240", "+12% questo mese")
        col_s2.metric("Positive", "88%", "🟢 Altissimo", delta_color="normal")
        col_s3.metric("Negative", "12%", "🔴 Monitorare", delta_color="inverse")
        
        c_left, c_right = st.columns(2)
        
        with c_left:
            st.markdown("##### Parole Chiave Recorrenti")
            # Mock Data per Bar Chart Parole
            mock_words = pd.DataFrame({
                'Parola': ['Qualità', 'Eleganza', 'Prezzo', 'Spedizione', 'Perlage', 'Servizio'],
                'Frequenza': [85, 70, 45, 30, 25, 10],
                'Sentiment': ['Positivo', 'Positivo', 'Neutro', 'Negativo', 'Positivo', 'Negativo']
            })
            fig_words = px.bar(
                mock_words, x='Frequenza', y='Parola', color='Sentiment',
                orientation='h', color_discrete_map={'Positivo': '#2ecc71', 'Negativo': '#e74c3c', 'Neutro': '#95a5a6'}
            )
            st.plotly_chart(fig_words, use_container_width=True)
            
        with c_right:
            st.markdown("##### Net Sentiment Over Time")
            # Mock Data per Line Chart Sentiment
            mock_dates = pd.date_range(start=date_range[0], periods=10, freq='D')
            mock_sent = [0.75, 0.80, 0.78, 0.82, 0.85, 0.83, 0.88, 0.86, 0.89, 0.90]
            fig_sent = px.line(x=mock_dates, y=mock_sent, labels={'x': 'Data', 'y': 'Net Sentiment score'})
            fig_sent.update_layout(yaxis_range=[0, 1])
            st.plotly_chart(fig_sent, use_container_width=True)

if __name__ == "__main__":
    main()
