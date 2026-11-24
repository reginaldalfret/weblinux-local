# WebLinux Local — Phase 6.4: Ubuntu GNOME Session Supervisor & Entrypoints

## 1. Supervisor Role & Responsibilities
The session supervisor bridges the WebLinux initramfs execution environment with the Ubuntu GNOME userspace.

### 1.1 Host-Guest Bind Mounts
When `/bin/ubuntu` initializes the guest filesystem, it mounts the following services from the initramfs host into the Ubuntu rootfs:
- `/usr/lib/wlserver` -> `/ubuntu/run/wlserver` (Wayland display server socket)
- `/usr/lib/hostnode` -> `/ubuntu/run/hostnode` (Node.js engine bridge)
- `/usr/lib/rvgpu` -> `/ubuntu/run/rvgpu` (Virgl / WebGL2 GPU socket)
- `/usr/lib/hostopen` -> `/ubuntu/run/hostopen` (Browser URL opener bridge)

---

## 2. Session Launcher Implementation
The GNOME 46 session is initiated via `/usr/local/bin/ubuntu-gnome-session`:

```sh
#!/bin/sh
echo "[Ubuntu GNOME Launcher] Initializing Ubuntu 24.04.5 LTS GNOME 46 Session..."
MISSING=""
for b in gnome-shell mutter; do
  if ! command -v "$b" >/dev/null 2>&1; then MISSING="$MISSING $b"; fi
done
if [ -n "$MISSING" ]; then
  echo "[Ubuntu GNOME Launcher ERROR] Required GNOME components missing: $MISSING" >&2
  echo "[Ubuntu GNOME Launcher ERROR] Status: BLOCKED - Package set unavailable." >&2
  exit 127
fi

echo "[Ubuntu GNOME Launcher] Preflight verified: gnome-shell and mutter are installed."
export GJS_DISABLE_JIT=1
export JS_DISABLE_JIT=1
export LIBGL_ALWAYS_SOFTWARE=1
export NO_AT_BRIDGE=1
export XDG_CURRENT_DESKTOP=GNOME
export XDG_SESSION_TYPE=wayland
export GDK_BACKEND=wayland
export XDG_RUNTIME_DIR=/run/user/0
mkdir -p -m 700 $XDG_RUNTIME_DIR

echo "[Ubuntu GNOME Launcher] Launching GNOME 46 session..."
exec dbus-run-session -- gnome-shell --nested --wayland
```

---

## 3. Operational Telemetry
During boot qualification in Microsoft Edge, the launcher executed cleanly:
```
[Ubuntu GNOME Launcher] Initializing Ubuntu 24.04.5 LTS GNOME 46 Session...
[Ubuntu GNOME Launcher] Preflight verified: gnome-shell and mutter are installed.
[Ubuntu GNOME Launcher] Launching GNOME 46 session...
libmutter-Message: 18:27:39.317: Running GNOME Shell (using mutter 46.2) as a Wayland display server
```
Mutter and GNOME Shell initiated the nested Wayland display server without crashing or throwing NOMMU faults.
