# Phase 2 — Mesa `virpipe` Integration

## 1. Guest Mesa Verification (Ubuntu 24.04.5 LTS `riscv64`)
- **Mesa Version:** `25.2.8-0ubuntu0.24.04.5` (`libgallium-25.2.8-0ubuntu0.24.04.5.so`, `libdril_dri.so`, `virtio_gpu_dri.so`, `libGLX_mesa.so.0.0.0`, `libGLESv2.so.2.1.0`).
- **Transport:** `GALLIUM_DRIVER=virpipe`, `VTEST_SOCKET_NAME=/tmp/runtime-root/rvgpu-0`.
- **Qt Quick Integration:** When `rvgpu-0.ready` is present, `/usr/local/bin/ubuntu-kde-session` unsets `QT_QUICK_BACKEND`, `QMLSCENE_DEVICE`, and `LIBGL_ALWAYS_SOFTWARE`, enabling Qt5's OpenGL scene graph (`qt.scenegraph.general: threaded render loop`, `Using sg animation driver`, `vsync: 16.67 ms`). If `rvgpu-0.ready` is absent, software QML rendering remains the automatic fallback.
