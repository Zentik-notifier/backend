# NTFY E2E scripts

## Mock NTFY server

Dummy NTFY server for E2E tests: accepts SSE subscribe and POST publish, and can emit incoming messages.

```bash
# Standalone (optional, for manual testing)
node scripts/ntfy/mock-ntfy-server.js
# Or with custom port
NTFY_MOCK_PORT=9999 node scripts/ntfy/mock-ntfy-server.js
```

The E2E test starts the mock automatically.

## E2E test suite

Tests all NTFY scenarios: publish, subscribe, sharing, forbidden use.

**Prerequisites**

- Backend running (e.g. `npm run start:dev`)
- Admin token in `TOKEN` (or use `.env`)

**Optional**

- `NTFY_MOCK_PORT` – mock server port (default `9999`)

The script calls `POST /api/v1/external-notify-systems/reload-ntfy-subscriptions` with the admin Bearer token so the backend reconnects to the mock after creating the system (required for subscribe tests).

**Run**

```bash
cd backend
export TOKEN="your_admin_access_token"
node scripts/ntfy/test-ntfy-e2e.js
```

From repo root:

```bash
BASE_URL=http://localhost:3000/api/v1 TOKEN=zat_xxx node backend/scripts/ntfy/test-ntfy-e2e.js
```

**Scenarios**

1. **Publish** – Create system + bucket linked to mock; send message; assert mock received POST.
2. **Subscribe** – Mock emits SSE message; assert backend creates message in bucket (requires reload after creating system if backend was already up).
3. **Sharing** – Share ExternalNotifySystem with user B; B links bucket (success). Unshare; B cannot link another bucket.
4. **Forbidden** – User C (no share) cannot link bucket to owner’s system (403).
