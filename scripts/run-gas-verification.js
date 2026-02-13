#!/usr/bin/env node
/**
 * Run GAS deployment verification via the web app endpoint.
 *
 * After `clasp push` + `clasp deploy`, the dev deployment serves
 * verifyAll() results at `?verify=1`. This script fetches that URL,
 * parses the JSON result, and writes gas-verification-results.json
 * for the GitHub Actions summary step.
 *
 * Required environment variables:
 *   GAS_VERIFY_URL - Full URL to the deployed web app (with /exec)
 *                    e.g. https://script.google.com/a/macros/sc3.club/s/<id>/exec
 *
 * No OAuth credentials needed — the web app is ANYONE_ANONYMOUS.
 */

const https = require('https');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const VERIFY_URL = process.env.GAS_VERIFY_URL;

if (!VERIFY_URL) {
  console.error('ERROR: GAS_VERIFY_URL environment variable is required');
  console.error(
    'Set it to your dev deployment URL, e.g.:',
    'https://script.google.com/a/macros/sc3.club/s/<deployment-id>/exec'
  );
  process.exit(1);
}

// Append ?verify=1
const url = new URL(VERIFY_URL);
url.searchParams.set('verify', '1');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Follow redirects and fetch the final response body.
 * GAS web apps redirect through accounts.google.com — we need to follow.
 * @param {string} fetchUrl
 * @param {number} [maxRedirects=10]
 * @returns {Promise<{statusCode: number, body: string, contentType: string}>}
 */
function fetchWithRedirects(fetchUrl, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    const mod = fetchUrl.startsWith('https') ? https : require('http');
    mod.get(fetchUrl, (res) => {
      // Follow redirects
      if (
        (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307) &&
        res.headers.location
      ) {
        if (maxRedirects <= 0) {
          return reject(new Error('Too many redirects'));
        }
        return fetchWithRedirects(res.headers.location, maxRedirects - 1).then(
          resolve,
          reject
        );
      }

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          body: data,
          contentType: res.headers['content-type'] || '',
        });
      });
    }).on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now();
  const targetUrl = url.toString();
  console.log(`Fetching verification results from:\n  ${targetUrl}\n`);

  const { statusCode, body, contentType } = await fetchWithRedirects(targetUrl);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (statusCode !== 200) {
    console.error(`HTTP error: ${statusCode}`);
    console.error(body.substring(0, 500));
    process.exit(1);
  }

  // Parse JSON response
  /** @type {any} */
  let result;
  try {
    result = JSON.parse(body);
  } catch {
    console.error('Response is not valid JSON:');
    console.error(contentType);
    console.error(body.substring(0, 1000));
    process.exit(1);
  }

  console.log(`GAS verification completed in ${elapsed}s`);

  if (typeof result.total !== 'number') {
    console.error('Unexpected result format from verifyAll():');
    console.error(JSON.stringify(result, null, 2).substring(0, 1000));
    process.exit(1);
  }

  // Print summary
  console.log(`\n${'='.repeat(55)}`);
  console.log(
    `  RESULTS: ${result.passed}/${result.total} passed` +
      (result.failed > 0 ? ` (${result.failed} FAILED)` : ' — ALL CLEAR')
  );
  console.log(`${'='.repeat(55)}\n`);

  // Print failures if any
  if (result.failed > 0) {
    console.log('Failed checks:');
    result.checks
      .filter((/** @type {any} */ c) => !c.passed)
      .forEach((/** @type {any} */ c) => {
        console.log(`  ✗ [${c.category}] ${c.name}: ${c.error}`);
      });
    console.log('');
  }

  // Write results to file for GitHub Actions summary
  fs.writeFileSync(
    'gas-verification-results.json',
    JSON.stringify(result, null, 2)
  );
  console.log('Results written to gas-verification-results.json');

  // Exit with error if failures
  if (result.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
