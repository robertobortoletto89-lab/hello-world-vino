import streamlit as st
import pandas as pd
import plotly.express as px

# --- CONFIGURAZIONE PAGINA ---
st.set_page_config(page_title="Market Intelligence | Villa Sandi", page_icon="🍾", layout="wide")

# Colori Brand Villa Sandi (Elegante grigio, oro e bordeaux)
st.markdown("""
    <style>
    .stTabs [data-baseweb="tab-list"] {gap: 20px;}
    .stTabs [data-baseweb="tab"] {padding: 10px 20px; font-weight: bold;}
    </style>
    """, unsafe_allow_html=True)

# --- INTESTAZIONE ---
st.title("🍾 Executive Dashboard: Villa Sandi")
st.markdown("**Focus Prodotto:** *Valdobbiadene Prosecco Superiore DOCG Millesimato*")
st.divider()

# Creiamo due Tab per dividere l'analisi
tab1, tab2 = st.tabs(["📊 Price Intelligence (Prototipo A)", "🧠 Sentiment & Percezione (Prototipo B)"])

# ==========================================
# TAB 1: PRICE INTELLIGENCE CON PLOTLY
# ==========================================
with tab1:
    st.subheader("Analisi Devianza Prezzi e Rischio Cannibalizzazione")
    st.write("Monitoraggio in tempo reale dei rivenditori online per proteggere il posizionamento Premium del brand e salvaguardare i margini del canale Ho.Re.Ca.")
    
    # 1. Dati simulati per il pitch (Nel mondo reale arriveranno dal tuo Google Sheet)
    dati_prezzi = pd.DataFrame({
        "Rivenditore": ["Tannico", "Callmewine", "Vino.com", "Bernabei", "Xtrawine", "Enoteca Pinciana"],
        "Prezzo (€)": [14.90, 15.00, 14.50, 10.90, 14.80, 15.50],
        "Stato": ["Regolare", "Regolare", "Regolare", "SOTTOCOSTO", "Regolare", "Regolare"]
    })
    
    prezzo_consigliato = 15.00
    
    # 2. Creazione del Grafico Interattivo con Plotly
    fig = px.bar(
        dati_prezzi, 
        x="Rivenditore", 
        y="Prezzo (€)", 
        color="Stato",
        color_discrete_map={"Regolare": "#2e4057", "SOTTOCOSTO": "#d90429"},
        text_auto='.2f',
        title="Dispersione Prezzi per Rivenditore Online"
    )
    
    # Aggiungiamo la linea del Prezzo Consigliato (MSRP)
    fig.add_hline(y=prezzo_consigliato, line_dash="dot", line_color="gold", 
                  annotation_text=f"Prezzo Consigliato ({prezzo_consigliato}€)", 
                  annotation_position="top right")
    
    fig.update_layout(yaxis_title="Prezzo di Vendita (€)", xaxis_title="")
    
    # Mostriamo il grafico in Streamlit
    st.plotly_chart(fig, use_container_width=True)
    
    # 3. Insight di Business (Il vero valore del tuo lavoro)
    col1, col2, col3 = st.columns(3)
    col1.metric("Prezzo Medio Rilevato", "14.26 €", "-4.9% vs Consigliato")
    col2.metric("Varianza Massima", "4.60 €", "Tra Bernabei ed Enoteca P.")
    col3.metric("Livello di Rischio Margini", "ELEVATO", "1 Venditore Canaglia", delta_color="inverse")
    
    st.info("💡 **Insight Strategico:** Il rivenditore 'Bernabei' sta vendendo il prodotto a 10.90€, creando un rischio altissimo di svalutazione del brand e lamentele da parte della rete vendita fisica (ristoranti ed enoteche) che non possono competere con questo prezzo.")

# ==========================================
# TAB 2: SENTIMENT ANALYSIS (LA TRAPPOLA)
# ==========================================
with tab2:
    st.subheader("ROI Marketing vs Percezione del Consumatore")
    st.write("L'Intelligenza Artificiale ha analizzato 100 recensioni recenti per estrarre le motivazioni di acquisto e i freni occulti sul vostro Millesimato.")
    
    # Posizioni 6-10 (Visibili)
    st.success("###### #10 - Perlage molto fine ed elegante (12 citazioni)")
    st.success("###### #9 - Bottiglia bellissima da regalare (18 citazioni)")
    st.success("###### #8 - Perfetto come aperitivo estivo (22 citazioni)")
    st.warning("###### #7 - Prezzo leggermente alto se comprato al supermercato (25 citazioni)")
    st.success("###### #6 - Acidità ben bilanciata (28 citazioni)")

    st.markdown("### 🔒 Le prime 5 posizioni sono riservate")
    st.write("Questi 5 punti contengono **2 criticità ricorrenti** che abbassano il tasso di riacquisto, e la **caratteristica numero 1** più amata dai clienti da usare nelle vostre Ads Facebook.")

    testo_sfocato = """
    <div style='filter: blur(5px); user-select: none; pointer-events: none; opacity: 0.7;'>
        <div style='background-color: #f0f2f6; padding: 15px; border-radius: 5px; margin-bottom: 10px;'>#5 - [CRITICITÀ SUL TAPPO/APERTURA] (35 citazioni)</div>
        <div style='background-color: #f0f2f6; padding: 15px; border-radius: 5px; margin-bottom: 10px;'>#4 - [ABBINAMENTO CIBO SBAGLIATO CONSIGLIATO] (42 citazioni)</div>
        <div style='background-color: #f0f2f6; padding: 15px; border-radius: 5px; margin-bottom: 10px;'>#3 - [CONFUSIONE CON IL PROSECCO BASE] (51 citazioni)</div>
        <div style='background-color: #f0f2f6; padding: 15px; border-radius: 5px; margin-bottom: 10px;'>#2 - [VANTAGGIO SUL COMPETITOR DI ZONA] (58 citazioni)</div>
        <div style='background-color: #ffcccc; padding: 15px; border-radius: 5px; font-weight: bold;'>#1 - [IL VERO MOTIVO PER CUI LO COMPRANO] (72 citazioni)</div>
    </div>
    """
    st.markdown(testo_sfocato, unsafe_allow_html=True)
    st.write("") 
    
    # CALL TO ACTION
    link_calendario = "https://www.linkedin.com/in/roberto/" # <-- METTI IL TUO LINK QUI
    st.link_button("🔓 Sblocca il Report Completo (Call di 15 min)", link_calendario, type="primary")