# CI/CD Setup Guide

This document explains how to configure GitHub Actions for automated testing and GAS deployment verification.

---

## Workflows

### 1. CI (`ci.yml`)

Runs on every push and PR. Validates:
- TypeScript type checking (`typecheck:src`)
- Project rule verification (`verify-rules`)
- Jest test suite (`npm test`)

**No secrets required** — this workflow runs entirely in Node.js.

### 2. Deploy & Verify (`deploy-verify.yml`)

Pushes code to the GAS environment, creates a versioned **staging** deployment, then runs `verifyAll()` by hitting the web app's `?verify=1` endpoint. The staging deployment is versioned and publicly accessible (`ANYONE_ANONYMOUS`), unlike the `@HEAD` deployment which requires domain authentication. Triggers:
- Automatically after CI passes on `main`
- Manually via `workflow_dispatch`

**Requires secrets + variables** — see setup below.

---

## How It Works

```
GitHub Actions                    Google Cloud
─────────────                    ─────────────
  ci.yml
    ├─ npm ci
    ├─ typecheck
    ├─ verify-rules
    └─ npm test
         │
         ▼ (on main, after CI passes)
  deploy-verify.yml
    ├─ clasp push  ──────────────→  GAS project (updates HEAD)
    ├─ clasp version ────────────→  Creates numbered version
    ├─ clasp deploy  ────────────→  Staging deployment (versioned, public)
    ├─ sleep 5     (propagation delay)
    └─ node scripts/run-gas-verification.js
         │
         ├─ GET <staging-url>?verify=1  (follows redirects)
         ├─ Receives JSON: { total, passed, failed, checks[], timestamp }
         └─ gas-verification-results.json → GitHub Step Summary
```

**No Execution API or OAuth token needed** — the versioned staging deployment is `ANYONE_ANONYMOUS`, so a simple HTTP GET fetches the verification results. The `?verify=1` parameter tells `doGet()` to run `verifyAll()` and return JSON instead of the normal HTML page.

> **Why staging, not dev?** The `@HEAD` dev deployment requires domain authentication even when the web app is configured as `ANYONE_ANONYMOUS`. Only versioned deployments are publicly accessible.

---

## Required Configuration

### Repository Secrets

Go to **Settings → Secrets and variables → Actions**.

#### `CLASP_CREDENTIALS`

The contents of your `.clasp-credentials.json` file (OAuth refresh token that clasp uses for push/deploy).

**To obtain:**

1. On your local machine:
   ```bash
   cat .clasp-credentials.json
   ```

2. Copy the **entire JSON** and add as a repository secret:
   - Name: `CLASP_CREDENTIALS`
   - Value: paste the full JSON

> The file format is `{ "tokens": { "default": { client_id, client_secret, refresh_token, ... } } }` (clasp 3.x format).

#### `CLASP_DEV_SCRIPT_ID`

The GAS script ID for the dev environment.

```bash
node -e "console.log(require('./package.json').config.CLASP_DEV_SCRIPT_ID)"
```

Add as a repository secret with name `CLASP_DEV_SCRIPT_ID`.

### Repository Variables

Go to **Settings → Secrets and variables → Actions → Variables tab**.

#### `GAS_STAGING_DEPLOYMENT_URL`

The full URL to the staging deployment's `/exec` endpoint.

```bash
# Construct it from package.json config:
node -e "
  const c = require('./package.json').config;
  console.log(c.GAS_BASE_DOMAIN + '/' + c.CLASP_STAGING_DEPLOYMENT_ID + c.GAS_EXEC_PATH);
"
```

Add as a repository **variable** (not secret — it's not sensitive):
- Name: `GAS_STAGING_DEPLOYMENT_URL`
- Value: the full URL

---

## Testing Locally

You can test the full flow locally before enabling in CI:

```bash
# 1. Deploy to staging (push + version + redeploy)
npm run stage:deploy

# 2. Set the URL and run verification
export GAS_VERIFY_URL="$(node -e "
  const c = require('./package.json').config;
  console.log(c.GAS_BASE_DOMAIN + '/' + c.CLASP_STAGING_DEPLOYMENT_ID + c.GAS_EXEC_PATH);
")"

node scripts/run-gas-verification.js
```

Expected output:
```
Fetching verification results from:
  https://script.google.com/a/macros/sc3.club/s/.../exec?verify=1

GAS verification completed in 12.3s

=======================================================
  RESULTS: 121/121 passed — ALL CLEAR
=======================================================

Results written to gas-verification-results.json
```

---

## Troubleshooting

### "Response is not valid JSON"
- The `?verify=1` endpoint wasn't reached — likely the deployment wasn't updated after push
- Run `clasp deploy -i <dev-deployment-id>` to update the deployment
- The response might be an HTML error page from Google

### "HTTP error: 401" or login page
- GAS web apps sometimes redirect to Google login for domain-restricted apps
- Verify `appsscript.json` has `"access": "ANYONE_ANONYMOUS"` in the `webapp` section
- Note: the verification endpoint runs before auth so it's always accessible

### clasp push fails in CI
- Check that `CLASP_CREDENTIALS` secret has the full JSON from `.clasp-credentials.json`
- The refresh token may have been revoked — re-run `clasp login` locally and update the secret

### Verification times out
- GAS has a 6-minute execution limit (30 min for Workspace accounts)
- If `verifyAll()` takes too long, check which E2E tests are slow

### Redirect loop
- GAS web apps do multiple redirects — the script follows up to 10
- If you hit "Too many redirects", the deployment URL may be wrong

---

## Security Considerations

1. **CLASP_CREDENTIALS** — encrypted by GitHub, only exposed to workflows in this repo. The refresh token runs as the user who authorized clasp (should be `membership_automation@sc3.club`)
2. **The `?verify=1` endpoint** runs `verifyAll()` which is read-only (structural checks + carefully scoped E2E tests). It doesn't modify production data
3. **The workflow only auto-triggers on `main`** — PR branches don't deploy to GAS
4. **Staging, not production** — verification runs against a staging deployment, never prod
5. **Results are public in the GitHub step summary** but only contain check names and pass/fail — no sensitive data
