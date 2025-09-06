# Keys Directory

Questa directory contiene le chiavi private per i servizi esterni.

## APNs (Apple Push Notifications)

Per le notifiche iOS, dovrai aggiungere qui il file della chiave privata APNs:

1. **Scarica la chiave APNs** dal tuo account Apple Developer:
   - Vai su https://developer.apple.com/account/resources/authkeys/list
   - Crea una nuova chiave con il servizio "Apple Push Notifications service (APNs)"
   - Scarica il file .p8

2. **Rinomina e sposta il file**:
   ```bash
   # Sposta il file scaricato in questa directory e rinominalo
   mv ~/Downloads/AuthKey_XXXXXXXXXX.p8 ./keys/apn-key.p8
   ```

3. **Aggiorna le variabili d'ambiente**:
   ```bash
   APN_KEY_ID=XXXXXXXXXX          # L'ID della chiave (10 caratteri)
   APN_TEAM_ID=YYYYYYYYYY         # Il tuo Team ID (10 caratteri)
   APN_PRIVATE_KEY_PATH=./keys/apn-key.p8
   APN_BUNDLE_ID=com.yourcompany.zentik
   APN_PRODUCTION=false           # true per production
   ```

## Sicurezza

⚠️ **IMPORTANTE**: 
- Non committare mai le chiavi private nel repository Git
- Il file `.gitignore` è configurato per escludere questa directory
- Usa variabili d'ambiente per la produzione
- Mantieni le chiavi al sicuro e ruotale regolarmente

## File Supportati

- `apn-key.p8` - Chiave privata APNs
- `*.p8` - Altre chiavi private Apple
- `*.json` - File di configurazione servizi (Firebase, etc.)
- `*.pem` - Certificati e chiavi in formato PEM

## Per la Produzione

In produzione, è raccomandato:
1. Usare servizi di gestione segreti (AWS Secrets Manager, Azure Key Vault, etc.)
2. Montare i segreti come volumi in container
3. Usare variabili d'ambiente per i path delle chiavi
