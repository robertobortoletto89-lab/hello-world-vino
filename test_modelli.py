import google.generativeai as genai

# Inserisci la TUA NUOVA API Key
genai.configure(api_key="AIzaSyAEWyUvlNJI0x17npClyS07LrU3DLLW8rw")

print("Sto interrogando Google... Ecco i modelli che puoi usare:")
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)