# WEBLINUX LOCAL — PHASE 5.2
# CI WORKFLOW ROOT CAUSE ANALYSIS REPORT

**Document ID:** `PHASE5-2-CI-001`  
**Failing GitHub Actions Run:** `https://github.com/reginaldalfret/weblinux-local/actions/runs/45370180500`  
**Failing Commit:** `22ad810bef90041d4316f2acbad4f7e9c1cd3c2f`  
**Host Runner:** Ubuntu 24.04 / `ubuntu-latest`  
**Node.js Version:** 22.x  
**Failing Command:** `npm ci`  

---

## 1. Problem Description

During execution of the GitHub Actions CI workflow on GitHub Actions run `45370180500`, the build pipeline failed at the `Install Dependencies` step with the following error:

```text
npm error code EUSAGE
npm error Missing: @rollup/rollup-linux-x64-gnu@4.68.8 from lock file
npm error Missing: @tailwindcss/oxide-linux-x64-gnu@4.3.5 from lock file
npm error Missing: lightningcss-linux-x64-gnu@1.33.0 from lock file
```

---

## 2. Technical Root Cause Analysis

### 2.1 The Nature of `npm ci`
`npm ci` (Clean Install) is strictly deterministic. It performs an upfront cryptographic integrity check comparing the declared dependencies in all `package.json` manifests (including workspaces) against the exact package definitions inside `package-lock.json`.
If any package declared in `package.json` does not have an identical, verified entry in `package-lock.json`, `npm ci` aborts immediately before modifying `node_modules`.

### 2.2 Why the Lockfile Was Desynchronized
1. **Windows-Only Lockfile Generation:** The repository's `package-lock.json` was generated and committed from a Windows 11 host environment (`win32-x64`).
2. When npm executes on Windows, its default resolver only pulls the optional platform binaries for the current OS/architecture (`@rollup/rollup-win32-x64-msvc`, `@tailwindcss/oxide-win32-x64-msvc`, and `lightningcss-win32-x64-msvc`). It omitted the corresponding Linux binaries from the lockfile's `packages` dictionary.
3. In Phase 5.1, `optionalDependencies` were declared in `weblinux-local/apps/web/package.json` to inform Vite and Tailwind of the Linux binaries, but `package-lock.json` was not synchronized to record their SHA-512 hashes, resolved URLs, and OS metadata.
4. **Invalid Workaround in CI Workflow:** The existing `.github/workflows/ci.yml` attempted to run:
   ```yaml
   - name: Install Dependencies
     run: npm ci

   - name: Install Platform Binaries (Linux x64)
     run: npm --prefix weblinux-local/apps/web install --no-save @rollup/rollup-linux-x64-gnu ...
   ```
   Because `npm ci` executes *before* the second step, the second step never ran. `npm ci` crashed at step 1 due to the missing lockfile entries.

---

## 3. Implemented Remediation

1. **Lockfile Synchronization:**
   Directly added the verified cross-platform entries for `@rollup/rollup-linux-x64-gnu@4.68.8`, `@tailwindcss/oxide-linux-x64-gnu@4.3.5`, and `lightningcss-linux-x64-gnu@1.33.0` into `package-lock.json` under both `weblinux-local/apps/web/node_modules/` and the workspace package descriptor.
2. **Deterministic CI Step:**
   Removed the fragile `--no-save` workaround step from `.github/workflows/ci.yml`. `npm ci` now installs both platform targets deterministically without extra commands.
3. **HTTP Server Readiness Probe:**
   Replaced arbitrary `sleep 5` in `.github/workflows/ci.yml` with a Node.js polling probe that tests `http://localhost:3000` until it returns HTTP 200 before proceeding to browser regression tests.
