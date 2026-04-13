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
        df_prezzi = pd.read_csv("storico_prezzi.csv", sep=";") 
        df_vini = pd.read_csv("database_vini.csv", sep=";") 
        
        # --- PULIZIA DATI DOPPI (Es. 16 Marzo) ---
        # Rimuove i duplicati basandosi su data, cantina, vino e sito
        df_prezzi = df_prezzi.drop_duplicates(subset=['DATA_ESTRAZIONE', 'CANTINA', 'NOME_PRODOTTO', 'SITO_ORIGINE'], keep='first')
        
        # Conversione data per ordinamento corretto
        df_prezzi['DATA_ESTRAZIONE'] = pd.to_datetime(df_prezzi['DATA_ESTRAZIONE'], format='mixed', dayfirst=True)
        
        df_vini_clean = df_vini[['CANTINA', 'NOME_PRODOTTO', 'PREZZO_BASE']]
        df_merged = pd.merge(df_prezzi, df_vini_clean, on=['CANTINA', 'NOME_PRODOTTO'], how='left')
        
        return df_merged
        
    except Exception as e:
        st.error(f"⚠️ Errore caricamento: {e}")
        return pd.DataFrame()

df_completo = load_data()
if df_completo.empty: st.stop()

# --- SIDEBAR ---
st.sidebar.title("🍷 Antigravity OS")
cantine_disponibili = df_completo['CANTINA'].dropna().unique().tolist()
cantina_selezionata = st.sidebar.selectbox("🏢 Seleziona Cantina", cantine_disponibili)
df_cantina = df_completo[df_completo['CANTINA'] == cantina_selezionata]
bottiglie_disponibili = df_cantina['NOME_PRODOTTO'].dropna().unique().tolist()
bottiglia_selezionata = st.sidebar.selectbox("🍾 Cerca Bottiglia", bottiglie_disponibili)
df_vino = df_cantina[df_cantina['NOME_PRODOTTO'] == bottiglia_selezionata].sort_values('DATA_ESTRAZIONE')

if st.sidebar.button("🔄 Reset Filtri"):
    st.experimental_rerun()

# --- PRICE INTELLIGENCE ---
st.title(cantina_selezionata)
st.subheader(f"{bottiglia_selezionata}")
st.markdown("---")

df_valid = df_vino[df_vino['PREZZO_RILEVATO'] > 0].copy()

if not df_valid.empty:
    prezzo_base = df_valid['PREZZO_BASE'].iloc[0]
    prezzo_medio = df_valid['PREZZO_RILEVATO'].mean()
    devianza = (prezzo_medio / prezzo_base) - 1

    col1, col2, col3 = st.columns(3)
    col1.metric("PREZZO BASE", f"€ {prezzo_base:,.2f}")
    col2.metric("PREZZO MEDIO", f"€ {prezzo_medio:,.2f}")
    col3.metric("DEVIANZA %", f"{devianza * 100:,.1f} %")

    # --- GRAFICO OTTIMIZZATO ---
    fig = go.Figure()
    safe_colors = ['#1f77b4', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#17becf', '#000080']
    marketplaces = df_valid['SITO_ORIGINE'].unique()

    for i, mp in enumerate(marketplaces):
        df_mp = df_valid[df_valid['SITO_ORIGINE'] == mp]
        
        marker_colors, marker_lines, marker_line_widths = [], [], []
        for _, row in df_mp.iterrows():
            if str(row.get('STOCKOUT', '')).strip().lower() == 'si':
                marker_colors.append('#000000'); marker_lines.append('#ffffff'); marker_line_widths.append(1)
            elif row['PREZZO_RILEVATO'] < prezzo_base:
                marker_colors.append('#ff4b4b')
                if pd.notna(row.get('PREZZO_SCONTATO')) and str(row.get('PREZZO_SCONTATO')).strip() != '':
                    marker_lines.append('#ffd700'); marker_line_widths.append(2)
                else:
                    marker_lines.append('#ff4b4b'); marker_line_widths.append(0)
            else:
                marker_colors.append(safe_colors[i % len(safe_colors)])
                if pd.notna(row.get('PREZZO_SCONTATO')) and str(row.get('PREZZO_SCONTATO')).strip() != '':
                    marker_lines.append('#ffd700'); marker_line_widths.append(2)
                else:
                    marker_lines.append(safe_colors[i % len(safe_colors)]); marker_line_widths.append(0)

        fig.add_trace(go.Scatter(
            x=df_mp['DATA_ESTRAZIONE'], y=df_mp['PREZZO_RILEVATO'],
            mode='lines+markers', name=mp,
            line=dict(color=safe_colors[i % len(safe_colors)], width=1.5),
            marker=dict(size=8, color=marker_colors, line=dict(color=marker_lines, width=marker_line_widths)),
            customdata=[f"{'⚠️ Sconto' if pd.notna(r['PREZZO_SCONTATO']) else ''} {'⛔ Out' if str(r['STOCKOUT']).lower()=='si' else ''}" for _,r in df_mp.iterrows()],
            hovertemplate="<b>" + mp + "</b><br>Data: %{x}<br>Prezzo: €%{y:.2f}<br><i>%{customdata}</i><extra></extra>"
        ))

    # PREZZO BASE - EVIDENZIATO
    fig.add_hline(y=prezzo_base, line_dash="dash", line_color="#00ff00", line_width=3, 
                  annotation_text=f"PREZZO BASE (€ {prezzo_base})", annotation_position="top left")

    fig.update_layout(
        hovermode="x unified", template="plotly_dark", plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(showgrid=False, dtick="D1", tickformat="%d\n%b"), # Doppia indicazione Giorno/Mese
        yaxis=dict(showgrid=True, gridcolor="rgba(255,255,255,0.1)")
    )
    st.plotly_chart(fig, use_container_width=True)

    # --- WALL OF SHAME (CORRETTA) ---
    st.subheader("Wall of Shame (Incidenza Sottocosto)")
    wall_of_shame_data = []
    for mp in marketplaces:
        df_mp = df_valid[df_valid['SITO_ORIGINE'] == mp]
        tot_giorni = df_mp['DATA_ESTRAZIONE'].nunique() # Calcolo su giorni univoci
        df_mp_sotto = df_mp[df_mp['PREZZO_RILEVATO'] < prezzo_base]
        
        scost_perc = (df_mp_sotto['DATA_ESTRAZIONE'].nunique() / tot_giorni) * 100
        delta_medio = (df_mp_sotto['PREZZO_RILEVATO'] - prezzo_base).mean() if not df_mp_sotto.empty else 0
        giorni_sconto = df_mp[df_mp['PREZZO_SCONTATO'].notna()]['DATA_ESTRAZIONE'].nunique()
        giorni_stockout = df_mp[df_mp['STOCKOUT'].astype(str).str.lower() == 'si']['DATA_ESTRAZIONE'].nunique()
        
        wall_of_shame_data.append({"Marketplace": mp, "% Sottocosto": f"{scost_perc:.1f}%", "Delta Medio": f"€ {delta_medio:.2f}", "Giorni Sconto": giorni_sconto, "Giorni Stockout": giorni_stockout})

    st.dataframe(pd.DataFrame(wall_of_shame_data).sort_values("% Sottocosto", ascending=False), use_container_width=True, hide_index=True)
else:
    st.info("Nessun dato trovato.")