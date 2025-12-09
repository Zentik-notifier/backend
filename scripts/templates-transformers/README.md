# Script per Template e Transformers

Questa cartella contiene script per testare e creare template e transformers/parsers.

## Struttura

```
templates-transformers/
├── README.md                          # Questo file
├── test-templates-transformers.js     # Script semplice per testare template e parsers
├── test-templates-transformers-advanced.js  # Script avanzato per testare con payload personalizzati
├── create-templates-parsers.js        # Script per creare template e parsers
└── examples/                          # File di esempio e configurazione
    ├── README.md                      # Documentazione dettagliata
    ├── template-example.json           # Esempio di template
    ├── template-example2.json         # Altro esempio di template
    ├── parser-example.json            # Esempio di parser
    ├── parser-example2.json           # Altro esempio di parser
    ├── create-config.json             # Configurazione per creare template/parsers
    ├── test-config.json               # Configurazione per testare
    ├── template-data.json             # Dati di esempio per template
    ├── github-payload.json            # Payload di esempio per GitHub
    ├── authentik-payload.json         # Payload di esempio per Authentik
    └── railway-payload.json           # Payload di esempio per Railway
```

## Script Disponibili

### 1. Test Template e Transformers (Semplice)

```bash
node templates-transformers/test-templates-transformers.js <magicCode> <template1> [template2] ... [parser1] [parser2] ...
```

**Esempio:**
```bash
node templates-transformers/test-templates-transformers.js abc12345 my-template authentic railway
```

### 2. Test Template e Transformers (Avanzato)

```bash
node templates-transformers/test-templates-transformers-advanced.js <magicCode> [options]
```

**Esempi:**
```bash
# Test con dati personalizzati
node templates-transformers/test-templates-transformers-advanced.js abc12345 --template my-template --data examples/template-data.json

# Test con payload personalizzato
node templates-transformers/test-templates-transformers-advanced.js abc12345 --parser authentic --payload examples/authentik-payload.json

# Usa configurazione
node templates-transformers/test-templates-transformers-advanced.js abc12345 --config examples/test-config.json
```

### 3. Crea Template e Parsers

```bash
node templates-transformers/create-templates-parsers.js <token> [options]
```

**Esempi:**
```bash
# Crea un template
node templates-transformers/create-templates-parsers.js <token> --template examples/template-example.json

# Crea un parser
node templates-transformers/create-templates-parsers.js <token> --parser examples/parser-example.json

# Usa configurazione
node templates-transformers/create-templates-parsers.js <token> --config examples/create-config.json
```

## Note Importanti

### Script di Test:
- Usano **magicCode** per l'autenticazione (non serve token)
- Testano template e parsers **esistenti**
- Supportano payload personalizzati

### Script di Creazione:
- Richiedono **token JWT o access token** (non magicCode)
- Creano **nuovi** template e parsers
- Supportano configurazioni complesse

## Documentazione Dettagliata

Per maggiori dettagli, consulta il file `examples/README.md`.

## Variabili d'Ambiente

- `BASE_URL` - URL base dell'API (default: `http://localhost:3000/api/v1`)
