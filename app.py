import streamlit as st
import pandas as pd
import plotly.graph_objects as go

# --- CONFIGURAZIONE PAGINA BENTO-DARK ---
st.set_page_config(page_title="Antigravity Wine OS", layout="wide")

# --- CARICAMENTO E JOIN DEI DATABASE ---
@st.cache_data(ttl=14400) # Cache 4 ore
def load_data():
    try:
        # 1. PREZZI
        df_prezzi = pd.read_csv("storico_prezzi.csv", sep=";") 
        df_prezzi['DATA_ESTRAZIONE'] = pd.to_datetime(df_prezzi['DATA_ESTRAZIONE'], format='mixed', dayfirst=True).dt.normalize()
        
        df_vini = pd.read_csv("database_vini.csv", sep=";") 
        df_vini_clean = df_vini[['CANTINA', 'NOME_PRODOTTO', 'PREZZO_BASE']]
        df_merged_prezzi = pd.merge(df_prezzi, df_vini_clean, on=['CANTINA', 'NOME_PRODOTTO'], how='left')
        
        # 2. SENTIMENT
        try:
            df_sent = pd.read_csv("sentiment_vini_elaborato.csv", sep=";", quoting=3)
            df_sent.columns = [c.strip('"') for c in df_sent.columns]
            for col in df_sent.columns:
                if df_sent[col].dtype == 'object':
                    df_sent[col] = df_sent[col].str.strip('"')
            df_sent['DATA_COMMENTO'] = pd.to_datetime(df_sent['DATA_COMMENTO'], errors='coerce')
            
            # Anagrafica univoca per evitare l'effetto moltiplicatore (Fix dei 300 commenti)
            anagrafica_univoca = df_vini_clean[['CANTINA', 'NOME_PRODOTTO']].drop_duplicates(subset=['NOME_PRODOTTO'])
            df_merged_sent = pd.merge(df_sent, anagrafica_univoca, on='NOME_PRODOTTO', how='left')
            
        except FileNotFoundError:
            df_merged_sent = pd.DataFrame()
            
        return df_merged_prezzi, df_merged_sent
        
    except Exception as e:
        st.error(f"⚠️ Errore caricamento database: {e}")
        return pd.DataFrame(), pd.DataFrame()

df_completo, df_sentiment = load_data()
if df_completo.empty: st.stop()

# ==========================================
# --- SIDEBAR: NAVIGAZIONE SUITE ---
# ==========================================
st.sidebar.title("🍷 Antigravity OS")
st.sidebar.markdown("---")

st.sidebar.subheader("🚀 Navigazione Suite")
menu_scelta = st.sidebar.radio(
    "Seleziona Modulo:",
    ["💰 Price Intelligence", "🗣️ Sentiment Analysis"]
)

st.sidebar.markdown("---")

st.sidebar.subheader("🔍 Filtri Globali")
cantine_disponibili = df_completo['CANTINA'].dropna().unique().tolist()
cantina_selezionata = st.sidebar.selectbox("🏢 Azienda", cantine_disponibili)

df_cantina = df_completo[df_completo['CANTINA'] == cantina_selezionata]
bottiglie_disponibili = df_cantina['NOME_PRODOTTO'].dropna().unique().tolist()
bottiglia_selezionata = st.sidebar.selectbox("🍾 Prodotto", bottiglie_disponibili)

st.sidebar.markdown("---")
if st.sidebar.button("🔄 Forza Aggiornamento Cache"):
    st.cache_data.clear()
    st.rerun()

st.title(f"{menu_scelta}")
st.subheader(f"{cantina_selezionata} - {bottiglia_selezionata}")
st.markdown("---")

# ==========================================
# LOGICA DEI MODULI
# ==========================================

if menu_scelta == "💰 Price Intelligence":
    df_vino = df_cantina[df_cantina['NOME_PRODOTTO'] == bottiglia_selezionata].sort_values('DATA_ESTRAZIONE')
    df_vino = df_vino.drop_duplicates(subset=['DATA_ESTRAZIONE', 'CANTINA', 'NOME_PRODOTTO', 'SITO_ORIGINE'], keep='first')
    df_valid = df_vino[df_vino['PREZZO_RILEVATO'] > 0].copy()

    if not df_valid.empty:
        prezzo_base = df_valid['PREZZO_BASE'].iloc[0]
        prezzo_medio = df_valid['PREZZO_RILEVATO'].mean()
        devianza = (prezzo_medio / prezzo_base) - 1
        
        # --- CALCOLO SOTTOCOSTO ---
        df_sottocosto = df_valid[df_valid['PREZZO_RILEVATO'] < prezzo_base]
        perc_sottocosto = (len(df_sottocosto) / len(df_valid)) * 100 if len(df_valid) > 0 else 0

        # --- 4 KPI IN ALTO ---
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("PREZZO BASE", f"€ {prezzo_base:,.2f}")
        col2.metric("PREZZO MEDIO", f"€ {prezzo_medio:,.2f}")
        col3.metric("DEVIANZA %", f"{devianza * 100:,.1f} %")
        col4.metric("🚨 % SOTTOCOSTO", f"{perc_sottocosto:.1f} %")

        # --- GRAFICO PREZZI ---
        fig = go.Figure()
        safe_colors = ['#1f77b4', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#17becf', '#000080']
        for i, mp in enumerate(df_valid['SITO_ORIGINE'].unique()):
            df_mp = df_valid[df_valid['SITO_ORIGINE'] == mp]
            fig.add_trace(go.Scatter(x=df_mp['DATA_ESTRAZIONE'], y=df_mp['PREZZO_RILEVATO'], name=mp, line=dict(color=safe_colors[i % len(safe_colors)])))
        
        fig.add_hline(y=prezzo_base, line_dash="dash", line_color="#00ff00", annotation_text="BASE")
        fig.update_layout(template="plotly_dark", hovermode="x unified")
        st.plotly_chart(fig, use_container_width=True)
        
        # --- WALL OF SHAME ---
        if not df_sottocosto.empty:
            st.markdown("---")
            st.subheader("🧱 Wall of Shame (Marketplace Sottocosto)")
            st.dataframe(
                df_sottocosto[['DATA_ESTRAZIONE', 'SITO_ORIGINE', 'PREZZO_RILEVATO']].sort_values(by='PREZZO_RILEVATO', ascending=True),
                use_container_width=True,
                hide_index=True
            )
        else:
            st.success("🎉 Nessun marketplace sta vendendo sotto il Prezzo Base!")
    else:
        st.info("Nessun dato di prezzo disponibile.")
        
elif menu_scelta == "🗣️ Sentiment Analysis":
    if not df_sentiment.empty:
        df_vino_sent = df_sentiment[(df_sentiment['CANTINA'] == cantina_selezionata) & 
                                    (df_sentiment['NOME_PRODOTTO'] == bottiglia_selezionata)]
        
        if not df_vino_sent.empty:
            tot_recensioni = len(df_vino_sent)
            rating_medio = df_vino_sent['RATING_ORIGINALE'].astype(float).mean()
            positivi = len(df_vino_sent[df_vino_sent['SENTIMENT_SCORE'] == 'Positivo'])
            sentiment_score = (positivi / tot_recensioni) * 100 if tot_recensioni > 0 else 0
            
            colA, colB, colC = st.columns(3)
            colA.metric("RATING MEDIO", f"⭐ {rating_medio:.1f} / 5.0")
            colB.metric("SENTIMENT SCORE", f"💚 {sentiment_score:.1f} %")
            colC.metric("RECENSIONI", f"📝 {tot_recensioni}")
            
            st.markdown("---")
            
            c1, c2 = st.columns([1, 1.5])
            
            with c1:
                st.subheader("Share of Sentiment")
                sent_counts = df_vino_sent['SENTIMENT_SCORE'].value_counts()
                fig_pie = go.Figure(data=[go.Pie(labels=sent_counts.index, values=sent_counts.values, hole=.4)])
                fig_pie.update_layout(template="plotly_dark", margin=dict(t=20, b=20, l=20, r=20))
                st.plotly_chart(fig_pie, use_container_width=True)
                
            with c2:
                st.subheader("☁️ Word Cloud (Cosa dicono i clienti)")
                try:
                    from wordcloud import WordCloud
                    import matplotlib.pyplot as plt
                    
                    # --- FILTRO STOPWORDS ITALIANE ---
                    stopwords_ita = set([
                        "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", 
                        "di", "a", "da", "in", "con", "su", "per", "tra", "fra", 
                        "e", "o", "ma", "se", "non", "che", "cui", "al", "allo", 
                        "alla", "ai", "agli", "alle", "del", "dello", "della", 
                        "dei", "degli", "delle", "nel", "nello", "nella", "nei", 
                        "negli", "nelle", "sul", "sullo", "sulla", "sui", "sugli", 
                        "sulle", "si", "mi", "ti", "ci", "vi", "ne", "è", "sono", 
                        "ha", "hanno", "come", "più", "molto", "poco", "tutto", 
                        "tutti", "questo", "quello", "quella", "anche", "solo"
                    ])
                    
                    df_pos = df_vino_sent[df_vino_sent['SENTIMENT_SCORE'] == 'Positivo']
                    df_neg = df_vino_sent[df_vino_sent['SENTIMENT_SCORE'] == 'Negativo']
                    
                    testo_pos = " ".join(df_pos['PAROLE_CHIAVE_ESTRATTE'].dropna().astype(str).tolist()).replace(',', ' ')
                    testo_neg = " ".join(df_neg['PAROLE_CHIAVE_ESTRATTE'].dropna().astype(str).tolist()).replace(',', ' ')
                    
                    wc_col_pos, wc_col_neg = st.columns(2)
                    
                    with wc_col_pos:
                        st.markdown("<h5 style='text-align: center; color: #00cc96;'>💚 Positive</h5>", unsafe_allow_html=True)
                        if testo_pos.strip():
                            wc_pos = WordCloud(
                                width=400, height=400, background_color='rgba(0,0,0,0)', 
                                mode='RGBA', colormap='Greens', max_words=40,
                                stopwords=stopwords_ita # <-- IL SETACCIO IN AZIONE
                            ).generate(testo_pos)
                            
                            fig_pos, ax = plt.subplots(figsize=(4, 4))
                            ax.imshow(wc_pos, interpolation='bilinear')
                            ax.axis("off")
                            fig_pos.patch.set_alpha(0)
                            st.pyplot(fig_pos)
                        else:
                            st.info("Nessuna parola positiva.")
                            
                    with wc_col_neg:
                        st.markdown("<h5 style='text-align: center; color: #EF553B;'>💔 Negative</h5>", unsafe_allow_html=True)
                        if testo_neg.strip():
                            wc_neg = WordCloud(
                                width=400, height=400, background_color='rgba(0,0,0,0)', 
                                mode='RGBA', colormap='Reds', max_words=40,
                                stopwords=stopwords_ita # <-- IL SETACCIO IN AZIONE
                            ).generate(testo_neg)
                            
                            fig_neg, ax = plt.subplots(figsize=(4, 4))
                            ax.imshow(wc_neg, interpolation='bilinear')
                            ax.axis("off")
                            fig_neg.patch.set_alpha(0)
                            st.pyplot(fig_neg)
                        else:
                            st.success("Nessuna parola negativa!")
                            
                except ImportError:
                    st.error("⚠️ Esegui nel terminale: pip install wordcloud matplotlib")
                    
            st.markdown("---")
            st.subheader("Dettaglio Commenti (Ultimi 50)")
            col_testo = 'TESTO_COMMENTO' if 'TESTO_COMMENTO' in df_vino_sent.columns else 'TESTO_ORIGINALE'
            df_show = df_vino_sent[['DATA_COMMENTO', 'SITO_ECOMMERCE', 'RATING_ORIGINALE', 'SENTIMENT_SCORE', col_testo]]
            st.dataframe(df_show.sort_values('DATA_COMMENTO', ascending=False).head(50), use_container_width=True, hide_index=True)
            
        else:
            st.info("Nessuna recensione trovata per questo prodotto.")
    else:
        st.warning("Database Sentiment non caricato.")