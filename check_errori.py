import pandas as pd
import os

def check_errori():
    file_storico = 'public/data/storico_prezzi.csv'
    file_database = 'public/data/database_vini.csv'

    if not os.path.exists(file_storico):
        print(f"Errore: Il file {file_storico} non esiste.")
        return

    if not os.path.exists(file_database):
        print(f"Errore: Il file {file_database} non esiste.")
        return

    try:
        # Carica lo storico prezzi (delimitatore punto e virgola)
        df_storico = pd.read_csv(file_storico, sep=';')
        # Rinominiamo le colonne dello storico per compatibilità
        df_storico = df_storico.rename(columns={
            'PREZZO_RILEVATO': 'Prezzo',
            'CANTINA': 'Cantina',
            'NOME_PRODOTTO': 'Vino',
            'SITO_ORIGINE': 'Sito'
        })
        
        # Carica il database dei vini (delimitatore punto e virgola)
        df_database = pd.read_csv(file_database, sep=';')
        # Rinominiamo le colonne del database per compatibilità
        df_database = df_database.rename(columns={
            'NOME_PRODOTTO': 'VINO',
            'SITO_ORIGINE': 'SITO_ECOMMERCE',
            'LINK_SCRAPING': 'LINK'
        })
    except Exception as e:
        print(f"Errore nel caricamento dei file: {e}")
        return

    # Assicuriamoci che la colonna Prezzo sia numerica (i non numerici diventano NaN)
    df_storico['Prezzo_Numerico'] = pd.to_numeric(df_storico['Prezzo'], errors='coerce')

    # Filtra: 
    # 1. Prezzo è NaN (vuoto, nullo o non numerico)
    # 2. Escludiamo i casi dove il prezzo è 0.0 (stockout volontari)
    # Nota: pd.isna() cattura i NaN. I valori 0.0 NON sono NaN.
    # Ma dobbiamo anche gestire i casi dove il prezzo potrebbe essere "vuoto" nel CSV originale.
    
    errori = df_storico[
        (pd.isna(df_storico['Prezzo_Numerico'])) & 
        (df_storico['Prezzo'].astype(str).str.strip().str.replace(',', '.') != '0.0') &
        (df_storico['Prezzo'].astype(str).str.strip().str.replace(',', '.') != '0')
    ]

    # Se non ci sono errori diretti nel file, potremmo voler segnalare anche se mancano dei dati?
    # Ma atteniamoci alla richiesta: "Filtra tutte le righe dove la colonna del prezzo è vuota..."

    if errori.empty:
        print("✅ Analisi completata: Nessun errore di scraping (prezzi non validi) trovato nello storico.")
        return

    # Join con il database per recuperare i link
    # Usiamo Cantina, Vino e Sito come chiavi di join
    errori_con_link = pd.merge(
        errori, 
        df_database[['CANTINA', 'VINO', 'SITO_ECOMMERCE', 'LINK']], 
        left_on=['Cantina', 'Vino', 'Sito'], 
        right_on=['CANTINA', 'VINO', 'SITO_ECOMMERCE'], 
        how='left'
    )

    print(f"🔎 TROVATI {len(errori_con_link)} ERRORI DI SCRAPING (Prezzo non catturato):\n")
    print("-" * 60)

    for _, row in errori_con_link.iterrows():
        print(f"🍷 VINO: {row['Vino']}")
        print(f"🏢 SITO: {row['Sito']}")
        print(f"🔗 LINK: {row['LINK']}")
        print("-" * 60)

if __name__ == "__main__":
    check_errori()
