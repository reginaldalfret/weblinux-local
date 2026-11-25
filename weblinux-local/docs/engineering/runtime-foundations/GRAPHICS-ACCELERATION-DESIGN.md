# WebLinux Local — Graphics Acceleration Design

```text
Default Path (Validated, Production):
  GNOME Shell / Mutter (LIBGL_ALWAYS_SOFTWARE=1)
        │ (Wayland shm buffers)
        ▼
  wlserver -> display.js (WebGL2 compositor on <canvas id="screen">)

Experimental VirGL Path (WEBLINUX_ENABLE_VIRGL_EXPERIMENTAL=1):
  Guest App (GALLIUM_DRIVER=virpipe, VTEST_SOCKET_NAME=/run/user/0/rvgpu-0)
        │ (vtest VirGL protocol)
        ▼
  /run/rvgpu/server.js (hostnode)
        │ (RVGP SharedArrayBuffer Ring)
        ▼
  gpu-exec.js (`proto` WebGL2 decoder | `vrend.wasm` [missing] | `rvgpu.wasm` [missing])
        │
        ▼
  WebGL2 / OffscreenCanvas -> display.js
```
