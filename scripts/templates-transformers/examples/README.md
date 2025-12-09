# Script di Test e Creazione per Template e Transformers

Questi script permettono di:
- **Testare** localmente vari template e transformers usando un magicCode
- **Creare** template e parsers usando un token JWT o access token

## Script Disponibili

### 1. `test-templates-transformers.js` (Semplice)

Script semplice per testare rapidamente template e transformers.

**Usage:**
```bash
node templates-transformers/test-templates-transformers.js <magicCode> <template1> [template2] ... [parser1] [parser2] ...
```

**Esempi:**
```bash
# Test un template
node templates-transformers/test-templates-transformers.js abc12345 my-template

# Test un parser
node templates-transformers/test-templates-transformers.js abc12345 authentic

# Test multiple template e parser
node templates-transformers/test-templates-transformers.js abc12345 my-template authentic railway github
```

**Parser Builtin Supportati:**
- `authentik` - Authentik events
- `servarr` - Radarr/Sonarr/Prowlarr events
- `railway` - Railway.com webhook events
- `github` - GitHub webhook events
- `expo` - Expo Application Services events
- `status-io` o `statusio` - Status.io incidents
- `instatus` - Instatus incidents
- `atlas-statuspage` - Atlassian Statuspage incidents

### 2. `test-templates-transformers-advanced.js` (Avanzato)

Script avanzato che supporta payload personalizzati e configurazioni complesse.

**Usage:**
```bash
# Test template con dati personalizzati
node templates-transformers/test-templates-transformers-advanced.js <magicCode> --template <name> --data <jsonFile>

# Test parser con payload personalizzato
node templates-transformers/test-templates-transformers-advanced.js <magicCode> --parser <name> --payload <jsonFile>

# Usa file di configurazione
node templates-transformers/test-templates-transformers-advanced.js <magicCode> --config <configFile>
```

**Esempi:**
```bash
# Test template con dati di default
node templates-transformers/test-templates-transformers-advanced.js abc12345 --template my-template

# Test template con dati personalizzati
node templates-transformers/test-templates-transformers-advanced.js abc12345 --template my-template --data examples/template-data.json

# Test parser con payload personalizzato
node templates-transformers/test-templates-transformers-advanced.js abc12345 --parser authentic --payload examples/authentik-payload.json

# Test multipli
node templates-transformers/test-templates-transformers-advanced.js abc12345 \
  --template my-template --data examples/template-data.json \
  --template another-template \
  --parser authentic --payload examples/authentik-payload.json \
  --parser github --payload examples/github-payload.json

# Usa file di configurazione
node templates-transformers/test-templates-transformers-advanced.js abc12345 --config examples/test-config.json
```

## Script di Creazione

### `create-templates-parsers.js`

Script per creare template e parsers (richiede autenticazione con token JWT o access token).

**Usage:**
```bash
# Crea un template
node templates-transformers/create-templates-parsers.js <token> --template examples/template-example.json

# Crea un parser
node templates-transformers/create-templates-parsers.js <token> --parser examples/parser-example.json

# Crea multipli template e parser
node templates-transformers/create-templates-parsers.js <token> \\
  --template examples/template-example.json \\
  --template examples/template-example2.json \\
  --parser examples/parser-example.json

# Usa file di configurazione
node templates-transformers/create-templates-parsers.js <token> --config examples/create-config.json
```

**Formato Template (JSON):**
```json
{
  "name": "my-template",
  "description": "Template description (optional)",
  "title": "Hello {{name}}!",
  "subtitle": "Status: {{status}}",
  "body": "Message: {{message}}"
}
```

**Formato Parser (JSON):**
```json
{
  "name": "my-parser",
  "jsEvalFn": "function transform(payload, bucketId, userId, headers) { return { title: 'Test', body: JSON.stringify(payload) }; }",
  "requiredUserSettings": []
}
```

## File di Esempio

Nella cartella `examples/` trovi:

### Per i test:
- `test-config.json` - Esempio di file di configurazione completo per i test
- `template-data.json` - Dati di esempio per template
- `github-payload.json` - Payload di esempio per GitHub parser
- `authentik-payload.json` - Payload di esempio per Authentik parser
- `railway-payload.json` - Payload di esempio per Railway parser

### Per la creazione:
- `create-config.json` - Esempio di file di configurazione per creare template e parsers
- `template-example.json` - Esempio di template da creare
- `template-example2.json` - Altro esempio di template
- `parser-example.json` - Esempio di parser da creare
- `parser-example2.json` - Altro esempio di parser

## Formato File di Configurazione

```json
{
  "magicCode": "YOUR_MAGIC_CODE_HERE",
  "baseUrl": "http://localhost:3000/api/v1",
  "templates": [
    {
      "name": "my-template",
      "data": { "name": "Test", "value": 42 }
    },
    {
      "name": "another-template",
      "dataFile": "./template-data.json"
    }
  ],
  "parsers": [
    {
      "name": "authentik",
      "payload": { "body": "loginSuccess: {...}" }
    },
    {
      "name": "github",
      "payloadFile": "./github-payload.json"
    }
  ]
}
```

## Variabili d'Ambiente

- `BASE_URL` - URL base dell'API (default: `http://localhost:3000/api/v1`)

## Note

### Script di Test:
- Gli script di test usano il magicCode per l'autenticazione, quindi non è necessario un token JWT
- I payload di esempio per i parser builtin sono forniti automaticamente se non specificati
- Gli script includono un piccolo delay tra le richieste per evitare rate limiting
- I risultati vengono mostrati in modo dettagliato con un riepilogo finale

### Script di Creazione:
- Gli script di creazione richiedono un token JWT o access token (non magicCode)
- I template usano Handlebars per il rendering (es. `{{name}}`, `{{#if condition}}...{{/if}}`)
- I parser sono funzioni JavaScript che trasformano payload in CreateMessageDto
- La funzione `transform` riceve: `payload`, `bucketId`, `userId`, `headers`
- La funzione deve restituire un oggetto con: `title`, `subtitle` (opzionale), `body`, `deliveryType`
