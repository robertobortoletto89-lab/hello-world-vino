import streamlit as st
import pandas as pd
import plotly.express as px

# --- 1. CONFIGURAZIONE PAGINA E RIMOZIONE MENU ---
st.set_page_config(page_title="Market Intelligence | Villa Sandi", layout="wide", initial_sidebar_state="collapsed")

# --- 2. IL "TRUCCO" CSS PER IL LOOK PREMIUM ---
st.markdown("""
    <style>
    /* Nasconde i loghi e i menu di default di Streamlit */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
    /* Importa un font elegante e moderno (Inter) */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap');
    html, body, [class*="css"]  {
        font-family: 'Inter', sans-serif;
    }
    
    /* Trasforma le metriche in "Card" in stile SaaS */
    div[data-testid="metric-container"] {
        background-color: #ffffff;
        border: 1px solid #e6e8eb;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        border-left: 5px solid #8b0000; /* Colore rosso scuro elegante */
    }
    
    /* Stile per i Tab */
    .stTabs [data-baseweb="tab-list"] {gap: 30px;}
    .stTabs [data-baseweb="tab"] {padding: 10px 20px; font-weight: 600; font-size: 16px;}
    </style>
    """, unsafe_allow_html=True)

# --- 3. INTESTAZIONE CORPORATE ---
# Usiamo colonne per mettere un finto logo (o il nome aziendale) e il titolo
col_header1, col_header2 = st.columns([3, 1])
with col_header1:
    st.markdown("## :material/insights: Executive Dashboard: Villa Sandi")
    st.markdown("**Monitoraggio Prodotto:** *Valdobbiadene Prosecco Superiore DOCG Millesimato*")
with col_header2:
    # Qui in futuro potrai inserire l'URL del logo di Villa Sandi con st.image()
    st.markdown("<div style='text-align: right; color: #8b0000; font-weight: bold; font-size: 24px;'>VILLA SANDI</div>", unsafe_allow_html=True)

st.divider()

# --- 4. TABS CON ICONE MATERIAL ---
tab1, tab2 = st.tabs([":material/monitoring: Price Intelligence", ":material/psychology: Sentiment & Percezione"])

# ==========================================
# TAB 1: PRICE INTELLIGENCE 
# ==========================================
with tab1:
    st.markdown("#### Devianza Prezzi e Rischio Cannibalizzazione")
    st.caption("Monitoraggio in tempo reale dei rivenditori online per proteggere il posizionamento Premium del brand.")
    st.write("") # Spazio vuoto
    
    col1, col2, col3 = st.columns(3)
    col1.metric("Prezzo Medio Rilevato", "14.26 €", "-4.9% vs Consigliato")
    col2.metric("Varianza Massima", "4.60 €", "Tra Bernabei ed Enoteca P.")
    col3.metric("Livello di Rischio", "ELEVATO", "-1 Venditore Canaglia", delta_color="inverse")
    
    st.write("")
    
    dati_prezzi = pd.DataFrame({
        "Rivenditore": ["Tannico", "Callmewine", "Vino.com", "Bernabei", "Xtrawine", "Enoteca Pinciana"],
        "Prezzo (€)": [14.90, 15.00, 14.50, 10.90, 14.80, 15.50],
        "Stato": ["Regolare", "Regolare", "Regolare", "SOTTOCOSTO", "Regolare", "Regolare"]
    })
    prezzo_consigliato = 15.00
    
    fig = px.bar(
        dati_prezzi, x="Rivenditore", y="Prezzo (€)", color="Stato",
        color_discrete_map={"Regolare": "#2b2d42", "SOTTOCOSTO": "#d90429"},
        text_auto='.2f'
    )
    fig.add_hline(y=prezzo_consigliato, line_dash="dot", line_color="#8d99ae", 
                  annotation_text=f"MSRP: {prezzo_consigliato}€", annotation_position="top right")
    fig.update_layout(yaxis_title="Prezzo di Vendita (€)", xaxis_title="", plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)")
    
    st.plotly_chart(fig, use_container_width=True)

# ==========================================
# TAB 2: SENTIMENT ANALYSIS
# ==========================================
with tab2:
    st.markdown("#### ROI Marketing vs Percezione del Consumatore")
    st.caption("Estrazione AI da 100 recensioni recenti per identificare motivazioni di acquisto e freni occulti.")
    st.write("")
    
    st.info("**#10** - Perlage molto fine ed elegante (12 cit.)", icon=":material/format_quote:")
    st.info("**#9** - Bottiglia bellissima da regalare (18 cit.)", icon=":material/format_quote:")
    st.warning("**#8** - Prezzo alto se comprato al supermercato (25 cit.)", icon=":material/warning:")
    
    st.markdown("### :material/lock: Le Top 5 sono riservate")
    st.caption("Contengono 2 criticità ricorrenti che abbassano il tasso di riacquisto.")

    testo_sfocato = """
    <div style='filter: blur(6px); user-select: none; pointer-events: none; opacity: 0.6;'>
        <div style='background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 10px; border-left: 4px solid #ced4da;'>#5 - [CRITICITÀ SUL TAPPO/APERTURA]</div>
        <div style='background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 10px; border-left: 4px solid #ced4da;'>#4 - [ABBINAMENTO CIBO SBAGLIATO]</div>
        <div style='background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 10px; border-left: 4px solid #ced4da;'>#3 - [CONFUSIONE CON IL PROSECCO BASE]</div>
        <div style='background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 10px; border-left: 4px solid #ced4da;'>#2 - [VANTAGGIO SUL COMPETITOR DI ZONA]</div>
        <div style='background-color: #ffe3e3; padding: 15px; border-radius: 5px; font-weight: bold; border-left: 4px solid #fa5252; color: #c92a2a;'>#1 - [IL VERO MOTIVO PER CUI LO COMPRANO]</div>
    </div>
    """
    st.markdown(testo_sfocato, unsafe_allow_html=True)
    st.write("") 
    
    link_calendario = "https://www.linkedin.com/in/roberto/" # <-- METTI IL TUO LINK QUI
    st.link_button("Sblocca il Report Completo", link_calendario, type="primary")