# Template and Transformer Scripts

This folder contains scripts to test and create templates and transformers/parsers.

## Structure

```
templates-transformers/
├── README.md                          # This file
├── test-templates-transformers.js     # Simple script to test templates and parsers
├── test-templates-transformers-advanced.js  # Advanced script to test with custom payloads
├── create-templates-parsers.js        # Script to create templates and parsers
└── examples/                          # Example and configuration files
    ├── README.md                      # Detailed documentation
    ├── template-example.json           # Template example
    ├── template-example2.json         # Another template example
    ├── parser-example.json            # Parser example
    ├── parser-example2.json           # Another parser example
    ├── create-config.json             # Configuration to create templates/parsers
    ├── test-config.json               # Configuration to test
    ├── template-data.json             # Example data for templates
    ├── github-payload.json            # Example payload for GitHub
    ├── authentik-payload.json         # Example payload for Authentik
    └── railway-payload.json           # Example payload for Railway
```

## Available Scripts

### 1. Test Templates and Transformers (Simple)

```bash
node templates-transformers/test-templates-transformers.js <magicCode> <template1> [template2] ... [parser1] [parser2] ...
```

**Example:**
```bash
node templates-transformers/test-templates-transformers.js abc12345 my-template authentic railway
```

### 2. Test Templates and Transformers (Advanced)

```bash
node templates-transformers/test-templates-transformers-advanced.js <magicCode> [options]
```

**Examples:**
```bash
# Test with custom data
node templates-transformers/test-templates-transformers-advanced.js abc12345 --template my-template --data examples/template-data.json

# Test with custom payload
node templates-transformers/test-templates-transformers-advanced.js abc12345 --parser authentic --payload examples/authentik-payload.json

# Use configuration
node templates-transformers/test-templates-transformers-advanced.js abc12345 --config examples/test-config.json
```

### 3. Create Templates and Parsers

```bash
node templates-transformers/create-templates-parsers.js <token> [options]
```

**Examples:**
```bash
# Create a template
node templates-transformers/create-templates-parsers.js <token> --template examples/template-example.json

# Create a parser
node templates-transformers/create-templates-parsers.js <token> --parser examples/parser-example.json

# Use configuration
node templates-transformers/create-templates-parsers.js <token> --config examples/create-config.json
```

## Important Notes

### Test Scripts:
- Use **magicCode** for authentication (no token needed)
- Test **existing** templates and parsers
- Support custom payloads

### Creation Scripts:
- Require **JWT or access token** (not magicCode)
- Create **new** templates and parsers
- Support complex configurations

## Detailed Documentation

For more details, see the `examples/README.md` file.

## Environment Variables

- `BASE_URL` - API base URL (default: `http://localhost:3000/api/v1`)
