import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import numpy as np

# --- CONFIGURAZIONE PAGINA BENTO-DARK ---
st.set_page_config(page_title="Antigravity Wine OS", layout="wide")

# --- CARICAMENTO E JOIN DEI DATABASE ---
@st.cache_data
def load_data():
    try:
        # 1. Carica il motore dei prezzi
        df_prezzi = pd.read_csv("storico_prezzi.csv", sep=";") 
        
        # 2. Carica l'anagrafica dei vini
        df_vini = pd.read_csv("database_vini.csv", sep=";") 
        
        # 3. FILTRO CHIRURGICO: Prendiamo SOLO le chiavi e il Prezzo Base dall'anagrafica
        # Questo evita che colonne doppie generino i suffissi _x e _y
        df_vini_clean = df_vini[['CANTINA', 'NOME_PRODOTTO', 'PREZZO_BASE']]
        
        # 4. MERGE PULITO
        df_merged = pd.merge(df_prezzi, df_vini_clean, on=['CANTINA', 'NOME_PRODOTTO'], how='left')
        
        return df_merged
        
    except FileNotFoundError as e:
        st.error(f"⚠️ File mancante: {e}. Assicurati che i CSV siano nel Codespace.")
        return pd.DataFrame()
    except KeyError as e:
        st.error(f"⚠️ Errore nelle colonne dell'anagrafica. Assicurati che database_vini.csv abbia CANTINA, NOME_PRODOTTO e PREZZO_BASE. Dettaglio: {e}")
        return pd.DataFrame()
# Richiama la funzione e crea il database
df_completo = load_data()

if df_completo.empty:
    st.stop() # Ferma l'app in sicurezza se non ci sono dati
    
# --- SIDEBAR: L'IMBUTO DEI DATI E MENU ---
st.sidebar.title("🍷 Antigravity OS")
st.sidebar.markdown("---")

# 1. Pannello Admin: Selezione Cantina
if 'CANTINA' in df_completo.columns:
    cantine_disponibili = df_completo['CANTINA'].dropna().unique().tolist()
else:
    st.sidebar.error("Errore: Colonna 'CANTINA' mancante nel database.")
    st.stop()

cantina_selezionata = st.sidebar.selectbox("🏢 Seleziona Cantina (Admin)", cantine_disponibili)

# Filtriamo il database in tempo reale lasciando SOLO i dati della cantina scelta
df_cantina = df_completo[df_completo['CANTINA'] == cantina_selezionata]

# 2. Selezione Bottiglia (dinamica in base alla Cantina)
if 'NOME_PRODOTTO' in df_cantina.columns:
    bottiglie_disponibili = df_cantina['NOME_PRODOTTO'].dropna().unique().tolist()
else:
    st.sidebar.error("Errore: Colonna 'NOME_PRODOTTO' mancante nel database.")
    st.stop()
    
bottiglia_selezionata = st.sidebar.selectbox("🍾 Cerca Bottiglia", bottiglie_disponibili)

# --- IL DATO ISOLATO ---
# Creiamo il dataframe specifico per la bottiglia selezionata
df_vino = df_cantina[df_cantina['NOME_PRODOTTO'] == bottiglia_selezionata]

st.sidebar.markdown("---")
# Pulsante Reset Filtri
if st.sidebar.button("🔄 Reset Filtri"):
    st.rerun()

# ==========================================
# --- SEZIONE 1: PRICE INTELLIGENCE ---
# ==========================================
st.title(cantina_selezionata)
st.subheader(f"{bottiglia_selezionata}")
st.markdown("---")

# 1. Pulizia dei dati (esclusione zeri)
df_valid = df_vino[df_vino['PREZZO_RILEVATO'] > 0].copy()

if not df_valid.empty:
    # --- CALCOLO KPI IN ALTO ---
    prezzo_base = df_valid['PREZZO_BASE'].iloc[0] # Assumiamo sia costante per la bottiglia
    prezzo_medio = df_valid['PREZZO_RILEVATO'].mean()
    devianza = (prezzo_medio / prezzo_base) - 1

    # Creazione dei 3 Box KPI in alto (Stile Bento-Light)
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric(label="PREZZO BASE", value=f"€ {prezzo_base:,.2f}")
    with col2:
        st.metric(label="PREZZO MEDIO", value=f"€ {prezzo_medio:,.2f}")
    with col3:
        # Mostriamo la devianza in percentuale
        st.metric(label="DEVIANZA %", value=f"{devianza * 100:,.1f} %")

    st.markdown("---")

    # --- GRAFICO DI TENDENZA (PLOTLY) ---
    st.subheader("Andamento Prezzi per Marketplace")
    
    fig = go.Figure()
    
    # Colori "Sicuri" (Nessun rosso, arancione, giallo o verde per le linee)
    safe_colors = ['#1f77b4', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#17becf', '#000080']
    marketplaces = df_valid['SITO_ORIGINE'].unique()

    for i, mp in enumerate(marketplaces):
        df_mp = df_valid[df_valid['SITO_ORIGINE'] == mp].sort_values('DATA_ESTRAZIONE')
        
        # Logica per i colori dei marker
        marker_colors = []
        marker_lines = []
        marker_line_widths = []
        
        for _, row in df_mp.iterrows():
            # Condizione 1: Stockout = Nero
            if str(row.get('STOCKOUT', '')).strip().lower() == 'si':
                marker_colors.append('black')
                marker_lines.append('black')
                marker_line_widths.append(1)
            # Condizione 2: Sotto Prezzo Base = Rosso
            elif row['PREZZO_RILEVATO'] < prezzo_base:
                marker_colors.append('red')
                # Condizione 2b: Sotto costo + Scontato = Rosso con alone (bordo) Giallo
                if pd.notna(row.get('PREZZO_SCONTATO')) and str(row.get('PREZZO_SCONTATO')).strip() != '':
                    marker_lines.append('yellow')
                    marker_line_widths.append(3) # Alone più spesso
                else:
                    marker_lines.append('red')
                    marker_line_widths.append(1)
            # Condizione 3: Scontato ma sopra il prezzo base = Colore standard ma alone giallo
            elif pd.notna(row.get('PREZZO_SCONTATO')) and str(row.get('PREZZO_SCONTATO')).strip() != '':
                 marker_colors.append(safe_colors[i % len(safe_colors)])
                 marker_lines.append('yellow')
                 marker_line_widths.append(3)
            # Condizione 4: Normale = Colore standard
            else:
                marker_colors.append(safe_colors[i % len(safe_colors)])
                marker_lines.append(safe_colors[i % len(safe_colors)])
                marker_line_widths.append(1)

        # Creazione Tooltip Custom
        custom_hovertemplate = (
            "<b>%{text}</b><br>" +
            "Data: %{x}<br>" +
            "Prezzo Rilevato: €%{y:.2f}<br>" +
            "<i>%{customdata}</i><extra></extra>"
        )
        
        # Generiamo il testo aggiuntivo per il tooltip (Sconti e Stockout)
        custom_data = []
        for _, row in df_mp.iterrows():
            note = ""
            if pd.notna(row.get('PREZZO_SCONTATO')) and str(row.get('PREZZO_SCONTATO')).strip() != '':
                note += "⚠️ Prezzo a Sconto<br>"
            if str(row.get('STOCKOUT', '')).strip().lower() == 'si':
                note += "⛔ STOCKOUT"
            custom_data.append(note)

        # Aggiungiamo la linea per il marketplace
        fig.add_trace(go.Scatter(
            x=df_mp['DATA_ESTRAZIONE'], 
            y=df_mp['PREZZO_RILEVATO'],
            mode='lines+markers',
            name=mp,
            line=dict(color=safe_colors[i % len(safe_colors)], width=2),
            marker=dict(
                size=10,
                color=marker_colors,
                line=dict(color=marker_lines, width=marker_line_widths)
            ),
            text=[mp] * len(df_mp), # Nome marketplace per il tooltip
            customdata=custom_data,
            hovertemplate=custom_hovertemplate
        ))

    # Aggiungiamo la linea tratteggiata del Prezzo Base
    fig.add_hline(y=prezzo_base, line_dash="dash", line_color="white", annotation_text=f"Prezzo Base (€ {prezzo_base})")

    fig.update_layout(
        xaxis_title="Data",
        yaxis_title="Prezzo (€)",
        hovermode="x unified",
        template="plotly_dark", # Attivato tema scuro nativo di Plotly
        plot_bgcolor="rgba(0,0,0,0)", # Sfondo trasparente per fondersi col Bento
        paper_bgcolor="rgba(0,0,0,0)"
    )
    
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")

    # --- TABELLE DI DETTAGLIO E WALL OF SHAME ---
    st.subheader("Wall of Shame (Incidenza Sottocosto)")

    # Calcoli globali
    sottocosto_df = df_valid[df_valid['PREZZO_RILEVATO'] < prezzo_base]
    
    if not df_valid.empty:
        scostamento_totale_perc = (len(sottocosto_df) / len(df_valid)) * 100
        if not sottocosto_df.empty:
            delta_medio_totale = (sottocosto_df['PREZZO_RILEVATO'] - prezzo_base).mean()
        else:
            delta_medio_totale = 0
            
        colA, colB = st.columns(2)
        colA.metric("% SCOSTAMENTO (SOTTOCOSTO)", f"{scostamento_totale_perc:.1f}%")
        colB.metric("DELTA MEDIO SOTTOCOSTO", f"€ {delta_medio_totale:.2f}")

    # Costruzione tabella Wall of Shame
    wall_of_shame_data = []
    
    for mp in marketplaces:
        df_mp = df_valid[df_valid['SITO_ORIGINE'] == mp]
        totale_rilevazioni = len(df_mp)
        
        if totale_rilevazioni > 0:
            df_mp_sotto = df_mp[df_mp['PREZZO_RILEVATO'] < prezzo_base]
            sottocosto_count = len(df_mp_sotto)
            scost_perc = (sottocosto_count / totale_rilevazioni) * 100
            
            delta_medio = (df_mp_sotto['PREZZO_RILEVATO'] - prezzo_base).mean() if sottocosto_count > 0 else 0
            
            giorni_sconto = df_mp[df_mp['PREZZO_SCONTATO'].notna() & (df_mp['PREZZO_SCONTATO'] != '')].shape[0]
            giorni_stockout = df_mp[df_mp['STOCKOUT'].astype(str).str.strip().str.lower() == 'si'].shape[0]
            
            wall_of_shame_data.append({
                "Marketplace": mp,
                "% Scostamento Negativo": f"{scost_perc:.1f}%",
                "Delta Medio": f"€ {delta_medio:.2f}",
                "Giorni a Sconto": giorni_sconto,
                "Giorni Stockout": giorni_stockout
            })
    if wall_of_shame_data:
        df_wall = pd.DataFrame(wall_of_shame_data)
        # Ordiniamo per chi fa più danni (Scostamento Negativo)
        df_wall = df_wall.sort_values(by='% Scostamento Negativo', ascending=False)
        st.dataframe(df_wall, use_container_width=True, hide_index=True)
else:
    st.info("Nessun dato valido superiore a 0€ trovato per i filtri selezionati.")