import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime

# --- CONFIGURAZIONE PAGINA ---
st.set_page_config(
    page_title="Price Intelligence Analysis",
    page_icon="🍷",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- STILE CUSTOM (Bento Grid) ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
        background-color: #ffffff;
    }

    .main {
        background-color: #ffffff;
    }

    /* Bento Box Style */
    .bento-card {
        background-color: #f8f9fa;
        border-radius: 16px;
        padding: 24px;
        border: 1px solid #f1f3f5;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .kpi-label {
        color: #6c757d;
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
    }

    .kpi-value {
        color: #212529;
        font-size: 1.8rem;
        font-weight: 700;
    }

    .kpi-delta {
        font-size: 0.9rem;
        margin-top: 4px;
    }

    /* Header Style */
    .header-title {
        font-weight: 700;
        color: #1a1a1a;
        margin-bottom: 2rem;
    }
    </style>
    """, unsafe_allow_html=True)

# --- FUNZIONI CARICAMENTO DATI ---

@st.cache_data(ttl=600)
def carica_dati():
    try:
        # Carica database vini per dettagli (Base Price, Image, etc.)
        try:
            df_vini = pd.read_csv('database_vini.csv', sep=';')
        except:
            df_vini = pd.read_csv('database_vini.csv', sep=',')
        
        # Pulizia nomi colonne
        df_vini.columns = df_vini.columns.str.strip()
        
        # PREZZO_BASE forced to float
        if 'PREZZO_BASE' in df_vini.columns:
            df_vini['PREZZO_BASE'] = pd.to_numeric(
                df_vini['PREZZO_BASE'].astype(str).str.replace(',', '.'), 
                errors='coerce'
            ).fillna(0)
        
        # Drop duplicates in df_vini to avoid fan-out
        df_vini_unique = df_vini.drop_duplicates(subset=['VINO']).copy()

        # Carica storico prezzi
        try:
            df_prezzi = pd.read_csv('storico_prezzi.csv', sep=',')
        except:
            df_prezzi = pd.read_csv('storico_prezzi.csv', sep=';')
        
        # Pulizia nomi colonne
        df_prezzi.columns = df_prezzi.columns.str.strip()
            
        df_prezzi['Data'] = pd.to_datetime(df_prezzi['Data'], errors='coerce')
        
        # Rinomina colonne per facilitare merge se necessario (o usa nomi originali)
        # Assumiamo storico_prezzi abbia 'Vino' e 'Sito'
        
        # Merge
        df = pd.merge(
            df_prezzi, 
            df_vini_unique[['VINO', 'IMM_URL', 'PREZZO_BASE', 'DESCRIZIONE']], 
            left_on='Vino', 
            right_on='VINO', 
            how='left'
        )
        
        # Converti prezzi a numerici
        df['Prezzo'] = pd.to_numeric(df['Prezzo'].astype(str).str.replace(',', '.'), errors='coerce')
        
        return df
    except Exception as e:
        st.error(f"Errore caricamento dati: {e}")
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
    
    st.markdown(f"""
        <div class="bento-card">
            <div class="kpi-label">{label}</div>
            <div class="kpi-value">{value}</div>
            {delta_html}
        </div>
    """, unsafe_allow_html=True)

# --- MAIN APP ---

def main():
    df_raw = carica_dati()
    
    if df_raw.empty:
        st.warning("Nessun dato trovato nei file CSV.")
        return

    # Sidebar
    st.sidebar.header("🔍 Filtri di Analisi")
    
    # Gestione nomi colonne dinamici (Sito vs SITO E-COMMERCE)
    col_sito = 'Sito' if 'Sito' in df_raw.columns else 'SITO_ECOMMERCE'
    if col_sito not in df_raw.columns:
        # Cerca varianti
        for c in df_raw.columns:
            if 'SITO' in c.upper():
                col_sito = c
                break

    cantine = sorted(df_raw['Cantina'].dropna().unique())
    cantina_scelta = st.sidebar.selectbox("Seleziona Cantina", cantine)
    
    df_cantina = df_raw[df_raw['Cantina'] == cantina_scelta].copy()
    
    vini = sorted(df_cantina['Vino'].unique())
    vino_scelto = st.sidebar.selectbox("Seleziona Bottiglia", vini, index=0)
    
    # Filtro Date
    min_date = df_cantina['Data'].min()
    max_date = df_cantina['Data'].max()
    
    if pd.isna(min_date): min_date = datetime.now()
    if pd.isna(max_date): max_date = datetime.now()
    
    date_range = st.sidebar.date_input(
        "Periodo DA - A",
        value=(min_date.date(), max_date.date()),
        min_value=min_date.date(),
        max_value=max_date.date()
    )

    # Intestazione
    st.markdown(f'<h1 class="header-title">Price Intelligence: {vino_scelto}</h1>', unsafe_allow_html=True)

    # Applica filtri
    df_f = df_cantina[df_cantina['Vino'] == vino_scelto].copy()
    if isinstance(date_range, tuple) and len(date_range) == 2:
        df_f = df_f[(df_f['Data'].dt.date >= date_range[0]) & (df_f['Data'].dt.date <= date_range[1])]

    if df_f.empty:
        st.info("Nessun dato disponibile per i filtri selezionati.")
        return

    # --- TOP SECTION (Bento Grid) ---
    col_main, col_kpi1, col_kpi2, col_kpi3 = st.columns([2.5, 1, 1, 1])
    
    ultimo_dato = df_f.sort_values('Data').iloc[-1]
    prezzo_base = ultimo_dato.get('PREZZO_BASE', 0)
    prezzo_medio = df_f['Prezzo'].mean()
    devianza = ((prezzo_medio - prezzo_base) / prezzo_base * 100) if prezzo_base and prezzo_base != 0 else 0

    with col_main:
        # Box rettangolare con Immagine e Dettagli
        img_url = ultimo_dato.get('IMM_URL', 'https://via.placeholder.com/150?text=No+Image')
        if pd.isna(img_url): img_url = 'https://via.placeholder.com/150?text=No+Image'
        
        st.markdown('<div class="bento-card">', unsafe_allow_html=True)
        inner_img, inner_txt = st.columns([1, 2.5])
        with inner_img:
            st.image(img_url, use_container_width=True)
        with inner_txt:
            st.markdown(f"""
                <div style="margin-top: 10px;">
                    <div style="color: #6c757d; font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">{cantina_scelta}</div>
                    <div style="font-weight: 700; font-size: 1.4rem; margin-bottom: 8px; color: #1a1a1a;">{vino_scelto}</div>
                    <div style="color: #495057; font-size: 1rem; margin-bottom: 4px;">Formato: 750ml</div>
                    <div style="color: #495057; font-size: 1rem;">Prezzo Base: <b>{format_euro(prezzo_base)}</b></div>
                </div>
            """, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    with col_kpi1:
        bento_metric("Prezzo Base", format_euro(prezzo_base))
    
    with col_kpi2:
        bento_metric("Prezzo Medio", format_euro(prezzo_medio))
        
    with col_kpi3:
        # Se il prezzo medio è sotto il base, devianza negativa (rosso)
        color = "normal" if devianza >= 0 else "inverse"
        bento_metric("Devianza %", f"{devianza:+.1f}%", delta_color=color)

    st.write("") # Spacer

    # --- MAIN GRAPH ---
    st.markdown('<div class="bento-card" style="padding: 20px;">', unsafe_allow_html=True)
    
    df_plot = df_f.copy()
    df_plot['Data_Str'] = df_plot['Data'].dt.strftime('%d/%m')
    df_plot = df_plot.sort_values('Data')

    # Barre rosse solo quando Prezzo < PREZZO_BASE
    df_plot['Colore'] = df_plot['Prezzo'].apply(lambda x: '#dc3545' if x < prezzo_base else '#4a90e2')

    fig = go.Figure()

    # Marketplace dinamici
    for sito in df_plot[col_sito].unique():
        df_sito = df_plot[df_plot[col_sito] == sito]
        fig.add_trace(go.Bar(
            x=df_sito['Data_Str'],
            y=df_sito['Prezzo'],
            name=str(sito),
            marker_color=df_sito['Colore'],
            hovertemplate="<b>%{fullData.name}</b><br>Prezzo: €%{y:.2f}<br>Data: %{x}<extra></extra>"
        ))

    # Linea orizzontale Prezzo Base
    fig.add_hline(
        y=prezzo_base, 
        line_dash="dash", 
        line_color="#333", 
        annotation_text=f"Prezzo Base ({format_euro(prezzo_base)})", 
        annotation_position="top left"
    )

    fig.update_layout(
        title="Andamento Prezzi per Marketplace (Barre Rosse = Sottocosto)",
        xaxis_title="",
        yaxis_title="Prezzo (€)",
        yaxis_range=[0, max(df_plot['Prezzo'].max(), prezzo_base) * 1.2],
        barmode='group',
        template="plotly_white",
        height=450,
        margin=dict(l=20, r=20, t=60, b=20),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
    )

    st.plotly_chart(fig, use_container_width=True)
    st.markdown('</div>', unsafe_allow_html=True)

    st.write("") # Spacer

    # --- BOTTOM SECTION ---
    col_scostamento, col_wos = st.columns([1, 1])

    with col_scostamento:
        # % combinazioni dove prezzo < listino
        totale_combinazioni = len(df_f)
        sottocosto = len(df_f[df_f['Prezzo'] < prezzo_base])
        perc_scostamento = (sottocosto / totale_combinazioni * 100) if totale_combinazioni > 0 else 0
        delta_assoluto = (prezzo_medio - prezzo_base)
        
        st.markdown(f"""
            <div class="bento-card">
                <div class="kpi-label">% SCOSTAMENTO (SOTTOCOSTO)</div>
                <div class="kpi-value">{perc_scostamento:.1f}%</div>
                <div class="kpi-delta" style="color: {'#dc3545' if delta_assoluto < 0 else '#28a745'};">
                    Delta Medio: {format_euro(delta_assoluto)}
                </div>
            </div>
        """, unsafe_allow_html=True)

    with col_wos:
        st.markdown('<div class="bento-card">', unsafe_allow_html=True)
        st.markdown('<div class="kpi-label">🚩 Wall of Shame (Incidenza Sottocosto)</div>', unsafe_allow_html=True)
        
        # Tabella ordinata decrescente per scostamento
        wos = df_f.groupby(col_sito).apply(
            lambda x: (x['Prezzo'] < prezzo_base).mean() * 100
        ).reset_index()
        wos.columns = ['Marketplace', '% Sottocosto']
        wos = wos.sort_values('% Sottocosto', ascending=False)
        
        st.dataframe(
            wos.style.format({'% Sottocosto': '{:.1f}%'}),
            hide_index=True,
            use_container_width=True
        )
        st.markdown('</div>', unsafe_allow_html=True)

if __name__ == "__main__":
    main()
