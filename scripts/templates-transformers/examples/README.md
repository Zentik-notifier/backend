# Test and Creation Scripts for Templates and Transformers

These scripts allow you to:
- **Test** templates and transformers locally using a magicCode
- **Create** templates and parsers using a JWT or access token

## Available Scripts

### 1. `test-templates-transformers.js` (Simple)

Simple script to quickly test templates and transformers.

**Usage:**
```bash
node templates-transformers/test-templates-transformers.js <magicCode> <template1> [template2] ... [parser1] [parser2] ...
```

**Examples:**
```bash
# Test a template
node templates-transformers/test-templates-transformers.js abc12345 my-template

# Test a parser
node templates-transformers/test-templates-transformers.js abc12345 authentic

# Test multiple templates and parsers
node templates-transformers/test-templates-transformers.js abc12345 my-template authentic railway github
```

**Supported Builtin Parsers:**
- `authentik` - Authentik events
- `servarr` - Radarr/Sonarr/Prowlarr events
- `railway` - Railway.com webhook events
- `github` - GitHub webhook events
- `expo` - Expo Application Services events
- `status-io` or `statusio` - Status.io incidents
- `instatus` - Instatus incidents
- `atlas-statuspage` - Atlassian Statuspage incidents

### 2. `test-templates-transformers-advanced.js` (Advanced)

Advanced script that supports custom payloads and complex configurations.

**Usage:**
```bash
# Test template with custom data
node templates-transformers/test-templates-transformers-advanced.js <magicCode> --template <name> --data <jsonFile>

# Test parser with custom payload
node templates-transformers/test-templates-transformers-advanced.js <magicCode> --parser <name> --payload <jsonFile>

# Use configuration file
node templates-transformers/test-templates-transformers-advanced.js <magicCode> --config <configFile>
```

**Examples:**
```bash
# Test template with default data
node templates-transformers/test-templates-transformers-advanced.js abc12345 --template my-template

# Test template with custom data
node templates-transformers/test-templates-transformers-advanced.js abc12345 --template my-template --data examples/template-data.json

# Test parser with custom payload
node templates-transformers/test-templates-transformers-advanced.js abc12345 --parser authentic --payload examples/authentik-payload.json

# Multiple tests
node templates-transformers/test-templates-transformers-advanced.js abc12345 \
  --template my-template --data examples/template-data.json \
  --template another-template \
  --parser authentic --payload examples/authentik-payload.json \
  --parser github --payload examples/github-payload.json

# Use configuration file
node templates-transformers/test-templates-transformers-advanced.js abc12345 --config examples/test-config.json
```

## Creation Script

### `create-templates-parsers.js`

Script to create templates and parsers (requires authentication with JWT or access token).

**Usage:**
```bash
# Create a template
node templates-transformers/create-templates-parsers.js <token> --template examples/template-example.json

# Create a parser
node templates-transformers/create-templates-parsers.js <token> --parser examples/parser-example.json

# Create multiple templates and parsers
node templates-transformers/create-templates-parsers.js <token> \\
  --template examples/template-example.json \\
  --template examples/template-example2.json \\
  --parser examples/parser-example.json

# Use configuration file
node templates-transformers/create-templates-parsers.js <token> --config examples/create-config.json
```

**Template Format (JSON):**
```json
{
  "name": "my-template",
  "description": "Template description (optional)",
  "title": "Hello {{name}}!",
  "subtitle": "Status: {{status}}",
  "body": "Message: {{message}}"
}
```

**Parser Format (JSON):**
```json
{
  "name": "my-parser",
  "jsEvalFn": "function transform(payload, bucketId, userId, headers) { return { title: 'Test', body: JSON.stringify(payload) }; }",
  "requiredUserSettings": []
}
```

## Example Files

In the `examples/` folder you'll find:

### For testing:
- `test-config.json` - Complete configuration file example for testing
- `template-data.json` - Example data for templates
- `github-payload.json` - Example payload for GitHub parser
- `authentik-payload.json` - Example payload for Authentik parser
- `railway-payload.json` - Example payload for Railway parser

### For creation:
- `create-config.json` - Configuration file example to create templates and parsers
- `template-example.json` - Template example to create
- `template-example2.json` - Another template example
- `parser-example.json` - Parser example to create
- `parser-example2.json` - Another parser example

## Configuration File Format

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

## Environment Variables

- `BASE_URL` - API base URL (default: `http://localhost:3000/api/v1`)

## Notes

### Test Scripts:
- Test scripts use magicCode for authentication, so no JWT token is needed
- Example payloads for builtin parsers are automatically provided if not specified
- Scripts include a small delay between requests to avoid rate limiting
- Results are shown in detail with a final summary

### Creation Scripts:
- Creation scripts require a JWT or access token (not magicCode)
- Templates use Handlebars for rendering (e.g. `{{name}}`, `{{#if condition}}...{{/if}}`)
- Parsers are JavaScript functions that transform payloads into CreateMessageDto
- The `transform` function receives: `payload`, `bucketId`, `userId`, `headers`
- The function must return an object with: `title`, `subtitle` (optional), `body`, `deliveryType`
