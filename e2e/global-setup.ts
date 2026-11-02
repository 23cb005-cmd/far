import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEALTH_URL = 'http://localhost:4000/api/v1/health';

/**
 * Playwright starts `webServer` and runs `globalSetup` concurrently, so the
 * API may not be reachable yet when this runs - poll until it is before
 * reseeding, rather than assuming startup order.
 */
async function waitForApi(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      throw new Error(`API did not become healthy at ${HEALTH_URL} within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export default async function globalSetup(): Promise<void> {
  await waitForApi(120_000);
  execSync('npm run seed -w server', { cwd: REPO_ROOT, stdio: 'inherit' });
}
