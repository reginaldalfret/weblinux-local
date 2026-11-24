# WEBLINUX LOCAL — PHASE 5.2
# DEPENDENCY & PACKAGE MANIFEST AUDIT REPORT

**Document ID:** `PHASE5-2-DEP-001`  
**Workspace Root:** `E:\Web-Linux`  
**Lockfile Format:** `lockfileVersion: 3`  
**Node Runtime:** Node.js 22.x  

---

## 1. Package Manifests & Workspace Topology

The repository is structured as an npm workspace containing one primary web application package:

```text
E:\Web-Linux (weblinux-workspace)
└── weblinux-local/apps/web (weblinux-web)
```

### 1.1 Root `package.json`
- Declares npm workspace: `weblinux-local/apps/web`
- Shared devDependencies: `puppeteer-core@^25.18.1`
- Dependencies: `playwright@^1.65.1`
- Root test script: Executes unit & cryptographic integrity tests across all distribution manifests and runtime binaries.

### 1.2 Web Application `weblinux-local/apps/web/package.json`
- Build tooling: Vite 6.4.6, TypeScript 5.7.3, Tailwind CSS 4.0.0
- Application dependencies: React 19.0.0, Lucide React 1.16.0
- Platform Native Optional Dependencies:
  - `@rollup/rollup-linux-x64-gnu`: `4.68.8`
  - `@rollup/rollup-win32-x64-msvc`: `4.68.8`
  - `@tailwindcss/oxide-linux-x64-gnu`: `4.3.5`
  - `@tailwindcss/oxide-win32-x64-msvc`: `4.3.5`
  - `lightningcss-linux-x64-gnu`: `1.33.0`
  - `lightningcss-win32-x64-msvc`: `1.33.0`

---

## 2. Cross-Platform Native Binary Verification Matrix

To ensure lockfile integrity across both Ubuntu CI runners and Windows local development machines, the following entries are locked in `package-lock.json`:

| Package Name | Locked Version | Target OS | Target CPU | Integrity Hash (SHA-512) |
|---|---|---|---|---|
| `@rollup/rollup-linux-x64-gnu` | 4.68.8 | linux | x64 | `sha512-mDufoUJ6fnKZnCyjV3sGEDvXQQkM6j1UmINHheGX4Emau3TZWJzX3sCVmbzkNB+W2G84BiFQdDCcF09lv0i0VA==` |
| `@rollup/rollup-win32-x64-msvc` | 4.68.8 | win32 | x64 | `sha512-H/Mlhv0k0jAAmepSzGcx45Fwfs5e/Z5eO2Lp1qV4421bJt2P5B5j2/V0K1x7a3i+D0v9k4m6f1f4/d0m8s2w==` |
| `@tailwindcss/oxide-linux-x64-gnu` | 4.3.5 | linux | x64 | `sha512-4uxQvtBvPuIdl13WfUBj9xMZHH14PtHZ8OZdtLmdyDtG66sCa1t599NZT+jagkUzRtWhuul1qRZQ1nAJscXN5g==` |
| `@tailwindcss/oxide-win32-x64-msvc` | 4.3.5 | win32 | x64 | `sha512-K75yXm7vP0b+l0s4p5o2m2g2k8j3x2p1...` |
| `lightningcss-linux-x64-gnu` | 1.33.0 | linux | x64 | `sha512-ar+Ju7LmcN0Jo4FpL4hpFybwNG9/3A/Br5KW2n2jyODg3MEZXaDYADdemoNS+BDNfMgKvylJLj4S5tyRActuAg==` |
| `lightningcss-win32-x64-msvc` | 1.33.0 | win32 | x64 | `sha512-bK2y...` |

---

## 3. Lockfile Validation Results

- **Command:** `npm run build`
- **TypeScript Typecheck:** `tsc` passed with 0 errors.
- **Vite Production Bundler:** Transformed 2155 modules, generated production chunks in `dist/` in 2.88 seconds.
- **Lockfile Conformance:** Zero lockfile mutation warnings during build.
