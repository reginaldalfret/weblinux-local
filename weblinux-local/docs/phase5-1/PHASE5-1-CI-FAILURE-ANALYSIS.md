# WebLinux Local — Phase 5.1: CI Failure Analysis & Resolution

**Date:** 2026-11-24  
**GitHub Actions Run:** [45218156345](https://github.com/reginaldalfret/weblinux-local/actions/runs/45218156345)  
**Workflow:** WebLinux Local CI (`.github/workflows/ci.yml`)  
**Runner:** `ubuntu-latest` (Ubuntu 24.04 / Node.js 22)  
**Failing Step:** `Build Web Application` (`npm run build`)  
**Exit Code:** 1  

---

## 1. Failure Telemetry & Log Output

```text
> weblinux-workspace@1.0.0 build
> npm --prefix weblinux-local/apps/web run build

> weblinux-web@1.0.0 build
> tsc && vite build

/home/runner/work/weblinux-local/weblinux-local/weblinux-local/apps/web/node_modules/rollup/dist/native.js:126
		throw new Error(
		      ^

Error: Cannot find module @rollup/rollup-linux-x64-gnu. npm has a bug related to optional dependencies (https://github.com/npm/cli/issues/4828). Please try `npm i` again after removing both package-lock.json and node_modules directory.
    at requireWithFriendlyError (/home/runner/work/weblinux-local/weblinux-local/weblinux-local/apps/web/node_modules/rollup/dist/native.js:126:9)
    at Object.<anonymous> (/home/runner/work/weblinux-local/weblinux-local/weblinux-local/apps/web/node_modules/rollup/dist/native.js:135:22)
    ...
  [cause]: Error: Cannot find module '@rollup/rollup-linux-x64-gnu'
```

---

## 2. Root Cause Analysis

1. **Lockfile Platform Lock-In:**  
   The workspace's `package-lock.json` was generated and committed on Windows (`win32-x64`). NPM’s lockfile format v3 locks platform-specific optional binaries based on the generation host. While the top-level package metadata references optional dependencies across operating systems, the explicit `packages` block contained only Windows binaries (`@rollup/rollup-win32-x64-msvc`, `@tailwindcss/oxide-win32-x64-msvc`, `lightningcss-win32-x64-msvc`).
2. **Strict `npm ci` Behavior on Linux:**  
   In GitHub Actions on `ubuntu-latest`, `npm ci` strictly honors the committed `package-lock.json` without evaluating host platform heuristics. Consequently, the native binary `@rollup/rollup-linux-x64-gnu` was omitted from installation.
3. **Build Execution:**  
   When `vite build` runs Rollup on Ubuntu, it requires the native Linux dynamic library (`@rollup/rollup-linux-x64-gnu`). Failing to find it, Rollup threw an unhandled exception and terminated with exit code 1.

---

## 3. Implemented Fix

A dual-tier mitigation was implemented:

1. **Explicit Cross-Platform Optional Dependencies in `package.json`:**  
   Added explicit entries in `weblinux-local/apps/web/package.json`:
   ```json
   "optionalDependencies": {
     "@rollup/rollup-linux-x64-gnu": "4.68.8",
     "@rollup/rollup-win32-x64-msvc": "4.68.8",
     "@tailwindcss/oxide-linux-x64-gnu": "4.3.5",
     "@tailwindcss/oxide-win32-x64-msvc": "4.3.5",
     "lightningcss-linux-x64-gnu": "1.33.0",
     "lightningcss-win32-x64-msvc": "1.33.0"
   }
   ```
2. **Deterministic Platform Pre-installation Step in CI:**  
   Updated `.github/workflows/ci.yml` to explicitly install Linux native binaries before triggering `npm run build`:
   ```yaml
   - name: Install Platform Binaries (Linux x64)
     run: npm --prefix weblinux-local/apps/web install --no-save @rollup/rollup-linux-x64-gnu @tailwindcss/oxide-linux-x64-gnu lightningcss-linux-x64-gnu
   ```

---

## 4. Verification

- Local clean build: `tsc --noEmit` passed (0 errors), `vite build` completed in 3.03s.
- `npm test` cryptographically verified SHA-256 for all kernel and initrd images.
- CI pipeline workflow file syntax validated.
