import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from wordcloud import WordCloud
import matplotlib.pyplot as plt
import numpy as np

# --- 1. CONFIGURAZIONE PAGINA ---
st.set_page_config(page_title="Antigravity Wine OS", layout="wide", initial_sidebar_state="expanded")

# --- 2. CUSTOM CSS (Blu scuro per sidebar, testi bianchi) ---
st.markdown("""
    <style>
    .main { background-color: #0e1117; color: white; }
    [data-testid="stSidebar"] { background-color: #0B192C !important; }
    [data-testid="stSidebar"] * { color: #ffffff !important; }
    div[data-baseweb="select"] ul li { color: black !important; }
    </style>
    """, unsafe_allow_html=True)

# --- 3. CARICAMENTO E PULIZIA DATI ---
@st.cache_data(ttl=3600)
def load_all_data():
    # Caricamento Storico Prezzi
    df_prezzi = pd.read_csv("public/data/storico_prezzi.csv", sep=";")
    df_prezzi['DATA_ESTRAZIONE'] = pd.to_datetime(df_prezzi['DATA_ESTRAZIONE'], format='mixed', dayfirst=True, errors='coerce').dt.normalize()
    
    for col in ['PREZZO_SCONTATO', 'PREZZO_ORIGINALE']:
        if col in df_prezzi.columns:
            df_prezzi[col] = pd.to_numeric(df_prezzi[col].astype(str).str.replace(',', '.'), errors='coerce')
    
    # Caricamento Database Vini
    df_vini = pd.read_csv("public/data/database_vini.csv", sep=";")
    if 'PREZZO_BASE' in df_vini.columns:
        df_vini['PREZZO_BASE'] = pd.to_numeric(df_vini['PREZZO_BASE'].astype(str).str.replace(',', '.'), errors='coerce')
        
    df_merged = pd.merge(df_prezzi, df_vini[['CANTINA', 'NOME_PRODOTTO', 'PREZZO_BASE']], on=['CANTINA', 'NOME_PRODOTTO'], how='left')
    
    # Caricamento Sentiment Elaborato
    df_sent = pd.read_csv("public/data/sentiment_vini_elaborato.csv", sep=";")
    df_sent['DATA_COMMENTO'] = pd.to_datetime(df_sent['DATA_COMMENTO'], format='mixed', dayfirst=True, errors='coerce').dt.normalize()
    if 'PAROLE_CHIAVE_ESTRATTE' in df_sent.columns:
        df_sent['PAROLE_CHIAVE_ESTRATTE'] = df_sent['PAROLE_CHIAVE_ESTRATTE'].fillna('')
    
    return df_merged, df_sent

try:
    df_p, df_s = load_all_data()

    # --- 4. SIDEBAR ---
    with st.sidebar:
        st.title("🚀 Wine OS")
        app_mode = st.radio("Seleziona modulo:", ["Price Intelligence", "Sentiment Analysis"])
        st.markdown("---")
        
        list_cantine = sorted(df_p['CANTINA'].dropna().unique())
        sel_cantina = st.selectbox("Seleziona Cantina", list_cantine)
        
        filtered_vini = sorted(df_p[df_p['CANTINA'] == sel_cantina]['NOME_PRODOTTO'].dropna().unique())
        sel_vino = st.selectbox("Seleziona Vino", filtered_vini)
        
        date_range = st.date_input("Intervallo temporale", 
                                   [df_p['DATA_ESTRAZIONE'].min(), df_p['DATA_ESTRAZIONE'].max()])

    start_date = pd.to_datetime(date_range[0])
    end_date = pd.to_datetime(date_range[1]) if len(date_range) > 1 else start_date

    # ==========================================
    # MODULO 1: PRICE INTELLIGENCE (Invariato)
    # ==========================================
    if app_mode == "Price Intelligence":
        st.title(f"📊 Price Intelligence")
        df_plot = df_p[(df_p['CANTINA'] == sel_cantina) & (df_p['NOME_PRODOTTO'] == sel_vino) & (df_p['DATA_ESTRAZIONE'].between(start_date, end_date))]
        
        if not df_plot.empty:
            prezzo_base = df_plot['PREZZO_BASE'].values[0]
            prezzo_medio = df_plot['PREZZO_SCONTATO'].mean()
            scostamento_perc = ((prezzo_medio - prezzo_base) / prezzo_base) * 100 if prezzo_base > 0 else 0

            col_img, col_info1, col_info2, col_info3 = st.columns([1, 1, 1, 1])
            with col_img: st.image("https://cdn-icons-png.flaticon.com/512/3208/3208726.png", width=80) 
            with col_info1: st.metric("PREZZO BASE (MAP)", f"€ {prezzo_base:.2f}")
            with col_info2: st.metric("Prezzo Medio Rilevato", f"€ {prezzo_medio:.2f}")
            with col_info3: st.metric("Scostamento dal Base", f"{scostamento_perc:.1f}%", delta=f"{scostamento_perc:.1f}%", delta_color="inverse" if scostamento_perc < 0 else "normal")

            st.markdown("---")
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=df_plot['DATA_ESTRAZIONE'], y=[prezzo_base]*len(df_plot), name="PREZZO BASE (MAP)", line=dict(color='black', width=4, dash='dash'), mode='lines'))
            pastel_colors = ['#aec6cf', '#ffb347', '#b39eb5', '#ff6961', '#77dd77', '#fdfd96', '#ffb7b2']
            sites = df_plot['SITO_ORIGINE'].unique()
            for i, mkt in enumerate(sites):
                df_mkt = df_plot[df_plot['SITO_ORIGINE'] == mkt].sort_values('DATA_ESTRAZIONE')
                fig.add_trace(go.Scatter(x=df_mkt['DATA_ESTRAZIONE'], y=df_mkt['PREZZO_SCONTATO'], name=mkt, line=dict(width=3, color=pastel_colors[i % len(pastel_colors)]), mode='lines+markers'))
            fig.update_layout(template="plotly_white", hovermode="x unified", height=500)
            st.plotly_chart(fig, use_container_width=True)

            st.markdown("---")
            col_kpi, col_wos = st.columns([1, 2])
            totale_rilevazioni = len(df_plot)
            df_under = df_plot[df_plot['PREZZO_SCONTATO'] < prezzo_base]
            count_under = len(df_under)
            perc_under = (count_under / totale_rilevazioni) * 100 if totale_rilevazioni > 0 else 0
            with col_kpi:
                st.subheader("📉 KPI Scostamenti")
                st.metric("Rilevazioni Sotto MAP", f"{count_under} su {totale_rilevazioni}")
                st.metric("% Violazioni Totali", f"{perc_under:.1f}%")
            with col_wos:
                st.subheader("⚠️ Wall of Shame")
                # ... logica wall of shame ...
                st.write("(Elenco siti con violazioni)")

    # ==========================================
    # MODULO 2: SENTIMENT ANALYSIS (Aggiornato)
    # ==========================================
    else:
        st.title(f"🍷 Sentiment Analysis")
        st.markdown(f"**Vino Analizzato:** {sel_vino}")
        
        df_plot_s = df_s[(df_s['NOME_PRODOTTO'] == sel_vino) & (df_s['DATA_COMMENTO'].between(start_date, end_date))]

        if not df_plot_s.empty:
            # --- KPI Superiori ---
            s1, s2, s3 = st.columns(3)
            avg_rating = df_plot_s['RATING_ORIGINALE'].mean()
            sent_counts = df_plot_s['SENTIMENT_SCORE'].value_counts()
            perc_pos = (sent_counts.get('Positivo', 0) / len(df_plot_s)) * 100
            
            s1.metric("Rating Medio", f"{avg_rating:.2f} ⭐")
            s2.metric("Sentiment Positivo", f"{perc_pos:.1f}%")
            s3.metric("Recensioni Totali", len(df_plot_s))

            st.markdown("---")
            
            # --- NUOVA FASCIA: WORDCLOUD - ANNELLO - WORDCLOUD ---
            col_wc_pos, col_donut, col_wc_neg = st.columns([1.5, 2, 1.5])
            
            stopwords_ita = ['di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'è', 'che', 'non', 'molto', 'vino', 'bottiglia', 'sapore', 'note']

            # 1. Word Cloud POSITIVA (Sinistra)
            with col_wc_pos:
                st.markdown("<h4 style='text-align: center; color: #77dd77;'>🟢 Punti di Forza</h4>", unsafe_allow_html=True)
                text_pos = " ".join(df_plot_s[df_plot_s['SENTIMENT_SCORE'] == 'Positivo']['PAROLE_CHIAVE_ESTRATTE'].astype(str))
                if text_pos.strip() and len(text_pos) > 5:
                    wc_pos = WordCloud(width=400, height=400, background_color='rgba(0,0,0,0)', mode="RGBA", colormap='Greens', stopwords=stopwords_ita).generate(text_pos)
                    fig_p, ax_p = plt.subplots(figsize=(5, 5))
                    ax_p.imshow(wc_pos, interpolation='bilinear')
                    ax_p.axis("off")
                    fig_p.patch.set_alpha(0)
                    st.pyplot(fig_p)
                else:
                    st.info("Dati positivi insufficienti")

            # 2. Grafico ad ANELLO (Centro)
            with col_donut:
                st.markdown("<h4 style='text-align: center;'>📊 Distribuzione Sentiment</h4>", unsafe_allow_html=True)
                # Ordine fisso per i colori
                labels = ['Positivo', 'Neutro', 'Negativo']
                values = [sent_counts.get(l, 0) for l in labels]
                colors = ['#2e7d32', '#9e9e9e', '#c62828'] # Verde scuro, Grigio, Rosso scuro

                fig_donut = go.Figure(data=[go.Pie(
                    labels=labels, 
                    values=values, 
                    hole=.6, 
                    marker_colors=colors,
                    textinfo='percent+label',
                    insidetextorientation='radial'
                )])
                fig_donut.update_layout(
                    showlegend=False,
                    margin=dict(t=0, b=0, l=0, r=0),
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(0,0,0,0)',
                    height=350
                )
                st.plotly_chart(fig_donut, use_container_width=True)

            # 3. Word Cloud NEGATIVA (Destra)
            with col_wc_neg:
                st.markdown("<h4 style='text-align: center; color: #ff6961;'>🔴 Criticità</h4>", unsafe_allow_html=True)
                text_neg = " ".join(df_plot_s[df_plot_s['SENTIMENT_SCORE'] == 'Negativo']['PAROLE_CHIAVE_ESTRATTE'].astype(str))
                if text_neg.strip() and len(text_neg) > 5:
                    wc_neg = WordCloud(width=400, height=400, background_color='rgba(0,0,0,0)', mode="RGBA", colormap='Reds', stopwords=stopwords_ita).generate(text_neg)
                    fig_n, ax_n = plt.subplots(figsize=(5, 5))
                    ax_n.imshow(wc_neg, interpolation='bilinear')
                    ax_n.axis("off")
                    fig_n.patch.set_alpha(0)
                    st.pyplot(fig_n)
                else:
                    st.success("Nessuna criticità rilevata")

            # --- Tabella Recensioni ---
            st.markdown("---")
            st.subheader("Dettaglio Recensioni")
            st.dataframe(
                df_plot_s[['DATA_COMMENTO', 'SITO_ORIGINE', 'RATING_ORIGINALE', 'SENTIMENT_SCORE', 'TESTO_COMMENTO']]
                .sort_values('DATA_COMMENTO', ascending=False), 
                use_container_width=True, hide_index=True
            )
        else:
            st.warning("Nessuna recensione trovata.")

except Exception as e:
    st.error(f"Errore: {e}")