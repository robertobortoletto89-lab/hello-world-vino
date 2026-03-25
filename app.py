import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime
from wordcloud import WordCloud
import matplotlib.pyplot as plt
import os

# --- CONFIGURAZIONE PAGINA ---
st.set_page_config(
    page_title="WineTech Intelligence Suite",
    page_icon="🍷",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- STILE CUSTOM (Bento Grid & UI) ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    html, body, [class*="css"] { font-family: 'Inter', sans-serif; background-color: #ffffff; }
    .main { background-color: #ffffff; }
    .bento-card { background-color: #f8f9fa; border-radius: 16px; padding: 24px; border: 1px solid #f1f3f5; box-shadow: 0 2px 4px rgba(0,0,0,0.02); height: 100%; display: flex; flex-direction: column; justify-content: center; margin-bottom: 20px; }
    .kpi-label { color: #6c757d; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .kpi-value { color: #212529; font-size: 1.8rem; font-weight: 700; }
    .kpi-delta { font-size: 0.9rem; margin-top: 4px; }
    .header-title { font-weight: 700; color: #1a1a1a; margin-bottom: 2rem; }
    .module-header { color: #6a0dad; font-weight: bold; }
    </style>
    """, unsafe_allow_html=True)

# --- MOCK LOGIN SYSTEM ---
def check_login():
    if 'ruolo' not in st.session_state: st.session_state['ruolo'] = 'Admin' 
    return st.session_state['ruolo']

# --- FUNZIONI CARICAMENTO DATI (ARCHITETTURA RELAZIONALE) ---
@st.cache_data(ttl=600)
def carica_dati_prezzi():
    if not os.path.exists('database_vini.csv') or not os.path.exists('storico_prezzi.csv'):
        st.error("⚠️ File CSV mancanti. Verifica che 'database_vini.csv' e 'storico_prezzi.csv' esistano.")
        return pd.DataFrame()

    try:
        # 1. Caricamento Master Vini
        df_vini = pd.read_csv('database_vini.csv', sep=';', encoding='utf-8-sig', engine='python')
        if 'PREZZO_BASE' in df_vini.columns:
            df_vini['PREZZO_BASE'] = pd.to_numeric(df_vini['PREZZO_BASE'].astype(str).str.replace(',', '.'), errors='coerce').fillna(0)
        df_vini_unique = df_vini.drop_duplicates(subset=['NOME_PRODOTTO']).copy()

        # 2. Caricamento Storico Prezzi
        df_prezzi = pd.read_csv('storico_prezzi.csv', sep=';', encoding='utf-8-sig', engine='python')
        df_prezzi['DATA_ESTRAZIONE'] = pd.to_datetime(df_prezzi['DATA_ESTRAZIONE'], format='%d/%m/%Y', errors='coerce')
        
        # 3. Pulizia ridondanze e Merge Relazionale (Magia)
        cols_to_drop = [c for c in df_prezzi.columns if c in df_vini_unique.columns and c != 'NOME_PRODOTTO']
        df_prezzi = df_prezzi.drop(columns=cols_to_drop)
        
        df = pd.merge(df_prezzi, df_vini_unique, on='NOME_PRODOTTO', how='left')
        df['PREZZO_RILEVATO'] = pd.to_numeric(df['PREZZO_RILEVATO'].astype(str).str.replace(',', '.'), errors='coerce').fillna(0)
            
        return df
    except Exception as e:
        st.error(f"Errore di formattazione nei CSV. Dettaglio: {e}")
        return pd.DataFrame()

@st.cache_data(ttl=600)
def carica_dati_sentiment(df_prezzi_master):
    if not os.path.exists('sentiment_vini_elaborato.csv'): return pd.DataFrame()
    try:
        df = pd.read_csv('sentiment_vini_elaborato.csv', sep=';', encoding='utf-8-sig', engine='python')
        
        # Le date ora si basano su DATA_COMMENTO (dal nuovo dizionario)
        if 'DATA_COMMENTO' in df.columns:
            df['DATA_COMMENTO'] = pd.to_datetime(df['DATA_COMMENTO'], errors='coerce').dt.date
        else:
            df['DATA_COMMENTO'] = datetime.today().date()
            
        # Incrociamo la Cantina usando la chiave primaria NOME_PRODOTTO
        if not df_prezzi_master.empty and 'CANTINA' not in df.columns and 'NOME_PRODOTTO' in df.columns:
            mappa_cantine = df_prezzi_master[['NOME_PRODOTTO', 'CANTINA']].drop_duplicates().set_index('NOME_PRODOTTO')['CANTINA'].to_dict()
            df['CANTINA'] = df['NOME_PRODOTTO'].map(mappa_cantine).fillna('Cantina Sconosciuta')
            
        return df
    except Exception as e:
        st.error(f"Errore diagnostico nel sentiment: {e}")
        return pd.DataFrame()

def format_euro(valore):
    if pd.isna(valore) or valore == 0: return "N/D"
    return f"€ {valore:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

# --- UI COMPONENTS ---
def bento_metric(label, value, delta=None, delta_color="normal"):
    delta_html = ""
    if delta:
        color = "#28a745" if delta_color == "normal" else "#dc3545"
        delta_html = f'<div class="kpi-delta" style="color: {color};">{delta}</div>'
    st.markdown(f'<div class="bento-card"><div class="kpi-label">{label}</div><div class="kpi-value">{value}</div>{delta_html}</div>', unsafe_allow_html=True)

# --- MODULO 1: PRICE INTELLIGENCE ---
def render_price_module(df_raw, cantina_scelta):
    df_cantina = df_raw[df_raw['CANTINA'] == cantina_scelta].copy()
    if df_cantina.empty:
        st.warning(f"Nessun dato trovato per la cantina {cantina_scelta}.")
        return
        
    vini = sorted(df_cantina['NOME_PRODOTTO'].dropna().unique())
    if not vini: return
    vino_scelto = st.sidebar.selectbox("Seleziona Bottiglia", vini, index=0)
    
    min_date = df_cantina['DATA_ESTRAZIONE'].min()
    max_date = df_cantina['DATA_ESTRAZIONE'].max()
    if pd.isna(min_date): min_date = datetime.now()
    if pd.isna(max_date): max_date = datetime.now()
    
    date_range = st.sidebar.date_input("Periodo DA - A", value=(min_date.date(), max_date.date()), min_value=min_date.date(), max_value=max_date.date(), key="date_price")

    st.markdown(f'<h1 class="header-title">Price Intelligence: {vino_scelto}</h1>', unsafe_allow_html=True)

    df_f = df_cantina[df_cantina['NOME_PRODOTTO'] == vino_scelto].copy()
    if isinstance(date_range, tuple) and len(date_range) == 2:
        df_f = df_f[(df_f['DATA_ESTRAZIONE'].dt.date >= date_range[0]) & (df_f['DATA_ESTRAZIONE'].dt.date <= date_range[1])]

    if df_f.empty:
        st.info("Nessun dato disponibile per i filtri selezionati.")
        return

    col_main, col_kpi1, col_kpi2, col_kpi3 = st.columns([2.5, 1, 1, 1])
    ultimo_dato = df_f.sort_values('DATA_ESTRAZIONE').iloc[-1]
    prezzo_base = ultimo_dato.get('PREZZO_BASE', 0)
    prezzo_medio = df_f['PREZZO_RILEVATO'].mean()
    devianza = ((prezzo_medio - prezzo_base) / prezzo_base * 100) if prezzo_base and prezzo_base != 0 else 0

    with col_main:
        img_url = ultimo_dato.get('URL_IMMAGINE', 'https://via.placeholder.com/150?text=No+Image')
        if pd.isna(img_url): img_url = 'https://via.placeholder.com/150?text=No+Image'
        st.markdown('<div class="bento-card">', unsafe_allow_html=True)
        inner_img, inner_txt = st.columns([1, 2.5])
        with inner_img: st.image(img_url, use_container_width=True)
        with inner_txt:
            st.markdown(f'<div style="margin-top: 10px;"><div style="color: #6c757d; font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">{cantina_scelta}</div><div style="font-weight: 700; font-size: 1.4rem; margin-bottom: 8px; color: #1a1a1a;">{vino_scelto}</div><div style="color: #495057; font-size: 1rem; margin-bottom: 4px;">Formato: 750ml</div><div style="color: #495057; font-size: 1rem;">Prezzo Base: <b>{format_euro(prezzo_base)}</b></div></div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    with col_kpi1: bento_metric("Prezzo Base", format_euro(prezzo_base))
    with col_kpi2: bento_metric("Prezzo Medio", format_euro(prezzo_medio))
    with col_kpi3: 
        color = "normal" if devianza >= 0 else "inverse"
        bento_metric("Devianza %", f"{devianza:+.1f}%", delta_color=color)

    st.markdown('<div class="bento-card" style="padding: 20px;">', unsafe_allow_html=True)
    df_plot = df_f.copy()
    df_plot['Data_Str'] = df_plot['DATA_ESTRAZIONE'].dt.strftime('%d/%m')
    df_plot = df_plot.sort_values('DATA_ESTRAZIONE')
    df_plot['Colore'] = df_plot['PREZZO_RILEVATO'].apply(lambda x: '#dc3545' if x < prezzo_base else '#4a90e2')

    fig = go.Figure()
    for sito in df_plot['SITO_ORIGINE'].dropna().unique():
        df_sito = df_plot[df_plot['SITO_ORIGINE'] == sito]
        fig.add_trace(go.Bar(x=df_sito['Data_Str'], y=df_sito['PREZZO_RILEVATO'], name=str(sito), marker_color=df_sito['Colore'], hovertemplate="<b>%{fullData.name}</b><br>Prezzo: €%{y:.2f}<br>Data: %{x}<extra></extra>"))

    fig.add_hline(y=prezzo_base, line_dash="dash", line_color="#333", annotation_text=f"Prezzo Base ({format_euro(prezzo_base)})", annotation_position="top left")
    fig.update_layout(title="Andamento Prezzi per Marketplace (Barre Rosse = Sottocosto)", xaxis_title="", yaxis_title="Prezzo (€)", yaxis_range=[0, max(df_plot['PREZZO_RILEVATO'].max(), prezzo_base) * 1.2], barmode='group', template="plotly_white", height=450, margin=dict(l=20, r=20, t=60, b=20), legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
    st.plotly_chart(fig, use_container_width=True)
    st.markdown('</div>', unsafe_allow_html=True)

    col_scostamento, col_wos = st.columns([1, 1])
    with col_scostamento:
        totale_combinazioni = len(df_f)
        sottocosto = len(df_f[df_f['PREZZO_RILEVATO'] < prezzo_base])
        perc_scostamento = (sottocosto / totale_combinazioni * 100) if totale_combinazioni > 0 else 0
        delta_assoluto = (prezzo_medio - prezzo_base)
        st.markdown(f'<div class="bento-card"><div class="kpi-label">% SCOSTAMENTO (SOTTOCOSTO)</div><div class="kpi-value">{perc_scostamento:.1f}%</div><div class="kpi-delta" style="color: {"#dc3545" if delta_assoluto < 0 else "#28a745"};">Delta Medio: {format_euro(delta_assoluto)}</div></div>', unsafe_allow_html=True)

    with col_wos:
        st.markdown('<div class="bento-card">', unsafe_allow_html=True)
        st.markdown('<div class="kpi-label">🚩 Wall of Shame (Incidenza Sottocosto)</div>', unsafe_allow_html=True)
        wos = df_f.groupby('SITO_ORIGINE').apply(lambda x: (x['PREZZO_RILEVATO'] < prezzo_base).mean() * 100).reset_index()
        wos.columns = ['Marketplace', '% Sottocosto']
        wos = wos.sort_values('% Sottocosto', ascending=False)
        st.dataframe(wos.style.format({'% Sottocosto': '{:.1f}%'}), hide_index=True, use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

# --- MODULO 2: SENTIMENT ANALYSIS ---
def render_sentiment_module(df_sent, cantina_scelta):
    if df_sent.empty:
        st.warning("Nessun dato di Sentiment trovato. Assicurati che il file 'sentiment_vini_elaborato.csv' sia presente.")
        return

    if 'NOME_PRODOTTO' not in df_sent.columns:
        st.error(f"⚠️ Errore critico nel CSV del Sentiment. Colonne trovate: {df_sent.columns.tolist()}.")
        return

    # Filtriamo per cantina (derivata in fase di caricamento)
    df_cantina_sent = df_sent[df_sent['CANTINA'] == cantina_scelta]
    if df_cantina_sent.empty:
         st.warning(f"Nessun dato di Sentiment elaborato per la cantina {cantina_scelta}.")
         return

    vini_disponibili = df_cantina_sent['NOME_PRODOTTO'].dropna().unique()
    vino_selezionato = st.sidebar.selectbox("Cerca bottiglia", vini_disponibili)
    
    start_date = st.sidebar.date_input("Da", value=pd.to_datetime("2023-01-01"), key="start_sent")
    end_date = st.sidebar.date_input("A", value=datetime.today(), key="end_sent")

    mask = (df_cantina_sent['NOME_PRODOTTO'] == vino_selezionato) & (df_cantina_sent['DATA_COMMENTO'] >= start_date) & (df_cantina_sent['DATA_COMMENTO'] <= end_date)
    df_filtered = df_cantina_sent.loc[mask]

    st.markdown(f'<h1 class="header-title module-header">Sentiment Analysis: {vino_selezionato}</h1>', unsafe_allow_html=True)

    col_img, col_info = st.columns([1, 4])
    with col_img: st.image("https://images.vivino.com/thumbs/14a9Y04fT1a-W3Xq0P5uAw_pb_x960.png", width=80)
    with col_info:
        st.markdown(f"**Cantina:** {cantina_scelta}")
        st.markdown(f"**Vino:** {vino_selezionato}")
        st.markdown("*Analisi Semantica basata sulle recensioni dirette dei consumatori.*")
    
    st.markdown("---")

    if not df_filtered.empty:
        tot_commenti = len(df_filtered)
        
        perc_positivi = len(df_filtered[df_filtered['SENTIMENT_SCORE'] == 'Positivo']) / tot_commenti * 100 if 'SENTIMENT_SCORE' in df_filtered.columns else 0
        perc_negativi = len(df_filtered[df_filtered['SENTIMENT_SCORE'] == 'Negativo']) / tot_commenti * 100 if 'SENTIMENT_SCORE' in df_filtered.columns else 0
        perc_neutri = len(df_filtered[df_filtered['SENTIMENT_SCORE'] == 'Neutro']) / tot_commenti * 100 if 'SENTIMENT_SCORE' in df_filtered.columns else 0

        col1, col2, col3 = st.columns(3)
        with col1: st.markdown(f"<div class='bento-card'><div class='kpi-label'>Totale Commenti</div><div class='kpi-value'>{tot_commenti}</div></div>", unsafe_allow_html=True)
        with col2: st.markdown(f"<div class='bento-card'><h3>Sentiment Breakdown</h3>🟢 <b>Positivi:</b> {perc_positivi:.1f}%<br>🔴 <b>Negativi:</b> {perc_negativi:.1f}%<br>⚪ <b>Neutri:</b> {perc_neutri:.1f}%</div>", unsafe_allow_html=True)
        with col3: st.markdown(f"<div class='bento-card'><h3>Origine Dati</h3><img src='https://www.vivino.com/apple-touch-icon.png' width='40'><br><b>Vivino:</b> {tot_commenti} recensioni</div>", unsafe_allow_html=True)

        st.markdown("<div class='bento-card'><h3>Sentiment over time</h3>", unsafe_allow_html=True)
        if 'SENTIMENT_SCORE' in df_filtered.columns:
            df_filtered['MESE_ANNO'] = pd.to_datetime(df_filtered['DATA_COMMENTO']).dt.to_period('M').astype(str)
            trend_data = df_filtered.groupby(['MESE_ANNO', 'SENTIMENT_SCORE']).size().reset_index(name='Conteggio')
            fig_trend = px.line(trend_data, x='MESE_ANNO', y='Conteggio', color='SENTIMENT_SCORE', color_discrete_map={"Positivo": "#2ecc71", "Negativo": "#e74c3c", "Neutro": "#95a5a6"}, markers=True)
            fig_trend.update_layout(xaxis_title="Tempo", yaxis_title="Numero Commenti", plot_bgcolor="rgba(0,0,0,0)")
            st.plotly_chart(fig_trend, use_container_width=True)
        st.markdown("</div>", unsafe_allow_html=True)

        col_wc1, col_wc2 = st.columns(2)
        def genera_wordcloud(testo, colormap):
            if not testo: return None
            wc = WordCloud(width=400, height=200, background_color="#f8f9fa", colormap=colormap).generate(testo)
            fig, ax = plt.subplots()
            ax.imshow(wc, interpolation="bilinear")
            ax.axis("off")
            fig.patch.set_facecolor('#f8f9fa')
            return fig

        if 'PAROLE_CHIAVE_ESTRATTE' in df_filtered.columns and 'SENTIMENT_SCORE' in df_filtered.columns:
            kw_positive = " ".join(df_filtered[df_filtered['SENTIMENT_SCORE'] == 'Positivo']['PAROLE_CHIAVE_ESTRATTE'].dropna().str.replace(',', ' '))
            kw_negative = " ".join(df_filtered[df_filtered['SENTIMENT_SCORE'] == 'Negativo']['PAROLE_CHIAVE_ESTRATTE'].dropna().str.replace(',', ' '))
        else:
            kw_positive = kw_negative = ""
            
        with col_wc1:
            st.markdown("<div class='bento-card'><h3>Motivazioni d'Acquisto (Positive)</h3>", unsafe_allow_html=True)
            if kw_positive: st.pyplot(genera_wordcloud(kw_positive, "Greens"))
            else: st.info("Dati insufficienti.")
            st.markdown("</div>", unsafe_allow_html=True)
            
        with col_wc2:
            st.markdown("<div class='bento-card'><h3>Criticità Rilevate (Negative)</h3>", unsafe_allow_html=True)
            if kw_negative: st.pyplot(genera_wordcloud(kw_negative, "Reds"))
            else: st.info("Dati insufficienti.")
            st.markdown("</div>", unsafe_allow_html=True)
    else:
        st.warning("Nessuna recensione trovata per il periodo e l'etichetta selezionata.")

# --- MAIN APP LOGIC ---
def main():
    ruolo_utente = check_login()
    st.sidebar.markdown("## Pannello di Controllo")
    st.sidebar.markdown(f"**Utente:** {ruolo_utente}")
    st.sidebar.markdown("---")
    
    modulo_scelto = st.sidebar.radio("Scegli Applicativo:", ["📊 Price Intelligence", "💬 Sentiment Analysis"])
    st.sidebar.markdown("---")

    df_raw = carica_dati_prezzi()
    df_sent = carica_dati_sentiment(df_raw)
    
    if df_raw.empty:
        return

    cantine_disponibili = sorted(df_raw['CANTINA'].dropna().unique())

    if ruolo_utente == 'Admin':
        st.sidebar.header("Impostazioni Admin")
        cantina_scelta = st.sidebar.selectbox("Filtra per Cantina Cliente", cantine_disponibili)
    else:
        cantina_scelta = ruolo_utente
        if cantina_scelta not in cantine_disponibili:
            st.error("Nessun dato assegnato al tuo account.")
            return

    st.sidebar.header("🔍 Filtri di Analisi")
    if modulo_scelto == "📊 Price Intelligence":
        render_price_module(df_raw, cantina_scelta)
    else:
        render_sentiment_module(df_sent, cantina_scelta)

if __name__ == "__main__":
    main()