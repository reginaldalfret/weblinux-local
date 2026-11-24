// SPDX-License-Identifier: GPL-2.0-only

/// Create a Linux machine and run it.
// (28) Whether the native programs on shared libraries (?dl=1, docs/wasm-dynamic-linking.md) are on: ?dl=1 yes, ?dl=0 no, and
// without either, yes in a page that is not Firefox (where the engine's code cap, about 2 GiB of wasm for the process, has not been
// tried with 180 MiB of native libraries on top of the emulator: Firefox stays off until someone checks it; ?dl=1 turns it on there).
// Not in a page (node-machine: no document) it is off unless asked. dev.html asks this same function for the kernel's command line and
// the nqs disk, so there is one place for the rule.
const rv_dl_wanted = (query, user_agent) => {
  if (/[?&]dl=1(&|$)/.test(query || "")) {
    return true;
  }
  if (/[?&]dl=0(&|$)/.test(query || "")) {
    return false;
  }
  // DEFAULT OFF since the live regression of 2026-10-13 (opening Konsole killed the Workers and the window server in Chrome): the native
  // programs are on only with ?dl=1 until a real Konsole, Dolphin and Kate launch passes on a default boot. Set to true to restore the default.
  const DEFAULT_ON = true;
  // Firefox is no longer left out: its code cap is kept by the JIT budget and the sharing rules of item 31.
  return DEFAULT_ON && typeof document != "undefined";
};
const linux = async (worker_url, variant, vmlinux, boot_cmdline, initrd, log, console_write, net_url, canvas, disk_options, jit_cache) => {
  // (30) Every task's Worker from one copy of the worker script, fetched now (see tools/patch-runtime.py).
  if (typeof document != "undefined" && typeof Blob == "function" && typeof URL != "undefined" && URL.createObjectURL) {
    try {
      const response = await fetch(worker_url);
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      worker_url = URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
    } catch (error) {
      log("[Main]: the worker script will be fetched for every task (" + error + ")");
    }
  }
  const arch_bits = variant.startsWith("wasm32_") ? 32 : 64;
  const Ulong = (arch_bits == 32) ? Number : BigInt;

  /// Dict of online CPUs.
  const cpus = {};

  /// Dict of tasks.
  const tasks = {};

  /// Input buffer (from keyboard to tty).
  let input_buffer = new ArrayBuffer(0);

  const text_decoder = new TextDecoder("utf-8");
  const text_encoder = new TextEncoder();

  /// Input (drivers/input/misc/wasm_input.c): events wait in a ring in shared memory, three words each (kind, code,
  /// value), until the kernel's input thread takes them. index[0] counts events put in, index[1] events taken out.
  const input = {
    slots: 1024,
    index: new Int32Array(new SharedArrayBuffer(8)),
  };
  input.words = new Int32Array(new SharedArrayBuffer(input.slots * 3 * 4));
  const INPUT_KEY = 0, INPUT_POSITION = 1, INPUT_BUTTON = 2, INPUT_WHEEL = 3;
  const input_event = (kind, code, value) => {
    const written = Atomics.load(input.index, 0);
    if (((written - Atomics.load(input.index, 1)) | 0) >= input.slots) {
      return;  // nobody is taking them: dropped
    }
    const slot = (written % input.slots) * 3;
    input.words[slot] = kind;
    input.words[slot + 1] = code;
    input.words[slot + 2] = value;
    Atomics.store(input.index, 0, (written + 1) | 0);
    raise_irq(IRQ_INPUT);
  };

  /// What the kernel calls the keys (linux/input-event-codes.h), by the browser's names for the physical keys.
  const key_codes = {
    Escape: 1, Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5, Digit5: 6, Digit6: 7, Digit7: 8, Digit8: 9, Digit9: 10,
    Digit0: 11, Minus: 12, Equal: 13, Backspace: 14, Tab: 15, KeyQ: 16, KeyW: 17, KeyE: 18, KeyR: 19, KeyT: 20,
    KeyY: 21, KeyU: 22, KeyI: 23, KeyO: 24, KeyP: 25, BracketLeft: 26, BracketRight: 27, Enter: 28, ControlLeft: 29,
    KeyA: 30, KeyS: 31, KeyD: 32, KeyF: 33, KeyG: 34, KeyH: 35, KeyJ: 36, KeyK: 37, KeyL: 38, Semicolon: 39,
    Quote: 40, Backquote: 41, ShiftLeft: 42, Backslash: 43, KeyZ: 44, KeyX: 45, KeyC: 46, KeyV: 47, KeyB: 48,
    KeyN: 49, KeyM: 50, Comma: 51, Period: 52, Slash: 53, ShiftRight: 54, NumpadMultiply: 55, AltLeft: 56,
    Space: 57, CapsLock: 58, F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64, F7: 65, F8: 66, F9: 67, F10: 68,
    NumLock: 69, ScrollLock: 70, Numpad7: 71, Numpad8: 72, Numpad9: 73, NumpadSubtract: 74, Numpad4: 75,
    Numpad5: 76, Numpad6: 77, NumpadAdd: 78, Numpad1: 79, Numpad2: 80, Numpad3: 81, Numpad0: 82,
    NumpadDecimal: 83, IntlBackslash: 86, F11: 87, F12: 88, NumpadEnter: 96, ControlRight: 97, NumpadDivide: 98,
    PrintScreen: 99, AltRight: 100, Home: 102, ArrowUp: 103, PageUp: 104, ArrowLeft: 105, ArrowRight: 106,
    End: 107, ArrowDown: 108, PageDown: 109, Insert: 110, Delete: 111, Pause: 119, MetaLeft: 125, MetaRight: 126,
    ContextMenu: 127,
  };
  const button_codes = [0x110, 0x112, 0x111];  // BTN_LEFT, BTN_MIDDLE, BTN_RIGHT, by the browser's button numbers

  /// The display (drivers/video/fbdev/wasm_fb.c): where the kernel last said the pixels are, or null.
  let fb = null;
  if (canvas) {
    const context = canvas.getContext("2d");
    let image = null, image_words = null;
    const draw = () => {
      if (fb) {
        if (!image || canvas.width != fb.width || canvas.height != fb.height) {
          canvas.width = fb.width;
          canvas.height = fb.height;
          image = context.createImageData(fb.width, fb.height);
          image_words = new Uint32Array(image.data.buffer);
        }
        // (A new view every time: the memory's buffer is another object after the memory has grown.)
        if (fb.pixels + fb.height * fb.stride <= memory.buffer.byteLength && fb.stride == fb.width * 4) {
          image.data.set(new Uint8Array(memory.buffer, fb.pixels, fb.height * fb.stride));
          // The fourth byte of a pixel is not used by the kernel; to a canvas it is opacity.
          for (let i = 0; i < image_words.length; i++) {
            image_words[i] |= 0xff000000;
          }
          context.putImageData(image, 0, 0);
        }
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);

    const position = (event) => {
      const box = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(32767, Math.round((event.clientX - box.left) / box.width * 32767)));
      const y = Math.max(0, Math.min(32767, Math.round((event.clientY - box.top) / box.height * 32767)));
      input_event(INPUT_POSITION, x, y);
    };
    canvas.addEventListener("keydown", (event) => {
      if (event.code in key_codes) {
        if (!event.repeat) {  // the kernel repeats keys itself
          input_event(INPUT_KEY, key_codes[event.code], 1);
        }
        event.preventDefault();
      }
    });
    canvas.addEventListener("keyup", (event) => {
      if (event.code in key_codes) {
        input_event(INPUT_KEY, key_codes[event.code], 0);
        event.preventDefault();
      }
    });
    canvas.addEventListener("mousemove", position);
    canvas.addEventListener("mousedown", (event) => {
      canvas.focus();
      position(event);
      input_event(INPUT_BUTTON, button_codes[event.button] || 0x110, 1);
      event.preventDefault();
    });
    canvas.addEventListener("mouseup", (event) => {
      input_event(INPUT_BUTTON, button_codes[event.button] || 0x110, 0);
      event.preventDefault();
    });
    canvas.addEventListener("wheel", (event) => {
      input_event(INPUT_WHEEL, 0, event.deltaY < 0 ? 1 : -1);
      event.preventDefault();
    }, { passive: false });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  /// The network (drivers/net/wasm_net.c): every binary message on this WebSocket is one Ethernet frame. Frames
  /// that arrive wait in a ring in shared memory until the kernel's receive thread takes them: index[0] counts the
  /// frames put in, index[1] the frames taken out, and each slot holds a 16-bit length and the frame.
  const net = {
    slots: 256,
    slot_size: 2048,
    index: new Int32Array(new SharedArrayBuffer(8)),
  };
  net.bytes = new Uint8Array(new SharedArrayBuffer(net.slots * net.slot_size));
  let net_socket = null;
  if (net_url) {
    net_socket = new WebSocket(net_url);
    net_socket.binaryType = "arraybuffer";
    net_socket.onopen = () => log("[Main]: rvRelay connected: " + net_url);
    net_socket.onerror = () => log("[Main]: no rvRelay at " + net_url);
    net_socket.onmessage = (event) => {
      const frame = new Uint8Array(event.data);
      const written = Atomics.load(net.index, 0);
      if (frame.length > net.slot_size - 2 || ((written - Atomics.load(net.index, 1)) | 0) >= net.slots) {
        return;  // too large, or the kernel is not keeping up: dropped, as a network may
      }
      const slot = (written % net.slots) * net.slot_size;
      net.bytes[slot] = frame.length & 0xff;
      net.bytes[slot + 1] = frame.length >> 8;
      net.bytes.set(frame, slot + 2);
      Atomics.store(net.index, 0, (written + 1) | 0);
      raise_irq(IRQ_NET);
    };
    // A connection that ends (the relay restarted, the computer slept, the wifi went away for a while) is made
    // again, with the same address (it is in the URL), every few seconds for as long as it takes: the kernel never
    // notices, and connections in the guest carry on or time out as they would on a network that went away.
    const net_reconnect = (delay) => {
      setTimeout(() => {
        const socket = new WebSocket(net_url);
        socket.binaryType = "arraybuffer";
        socket.onmessage = net_socket.onmessage;
        socket.onopen = () => {
          log("[Main]: rvRelay connected again: " + net_url);
          net_socket = socket;
        };
        socket.onclose = () => {
          if (net_socket !== socket) {
            net_reconnect(Math.min(delay * 2, 30000));
          }
        };
        socket.addEventListener("close", () => {
          if (net_socket === socket) {
            log("[Main]: rvRelay lost; connecting again");
            net_reconnect(2000);
          }
        });
      }, delay);
    };
    net_socket.onclose = () => {
      log("[Main]: rvRelay lost; connecting again");
      net_reconnect(2000);
    };
  }

  /// (33) The state of the relay, as frames in the receive ring (see the docstring of tools/patch-runtime.py, item 33).
  if (net_url) {
    let net_status_state = -1;
    let net_status_at = 0;
    const net_status = () => {
      const state = net_socket ? (net_socket.readyState == WebSocket.OPEN ? 1 : net_socket.readyState == WebSocket.CONNECTING ? 2 : 0) : 0;
      const now = Date.now();
      if (state == net_status_state && now - net_status_at < 3000) {
        return;
      }
      net_status_state = state;
      net_status_at = now;
      const written = Atomics.load(net.index, 0);
      if (((written - Atomics.load(net.index, 1)) | 0) >= net.slots) {
        return;
      }
      const frame = new Uint8Array(60);
      frame.fill(0xff, 0, 6);
      frame.set([0x02, 0x52, 0x56, 0x00, 0x00, 0x01, 0x88, 0xb5, 0x52, 0x56, 0x4e, 0x45, 0x54, 0x31, state], 6);
      const slot = (written % net.slots) * net.slot_size;
      net.bytes[slot] = frame.length & 0xff;
      net.bytes[slot + 1] = frame.length >> 8;
      net.bytes.set(frame, slot + 2);
      Atomics.store(net.index, 0, (written + 1) | 0);
    };
    setInterval(net_status, 1000);
  }
  const lock_notify = (locks, lock, count) => {
    Atomics.store(locks._memory, locks[lock], 1);
    Atomics.notify(locks._memory, locks[lock], count || 1);
  };

  const lock_wait = (locks, lock) => {
    while (Atomics.exchange(locks._memory, locks[lock], 0) == 0) {
      Atomics.wait(locks._memory, locks[lock], 0);
    }
  };

  /// What the Workers asked of the main thread, lately, in the order it was asked (tools/kernel-flags.js reads it
  /// out of a machine that has stopped): [the time in ms, what, the task switched from or released, the task
  /// switched to or made]. What: S a switch, C a switch to a new task, R a release, K a Worker ended, U a CPU
  /// started, X a CPU stopped. And the name of each task's runner, by the task.
  const switch_log = [];
  const runner_names = {};
  const switch_note = (what, prev, next) => {
    if (switch_log.length >= 4000) {
      switch_log.splice(0, 1000);
    }
    switch_log.push([performance.now(), what, prev, next]);
  };
  /// Workers that threw inside the kernel (their names and errors), for tools/kernel-flags.js.
  const kernel_crashes = [];
  /// The ring the Workers write their switches into (linux-worker.js: switch_note), and the book with it: the
  /// main thread's own notes and the ring's, in the order of their times (each [ms, what, from, to]).
  const switch_ring = { slots: 4096, index: new Int32Array(new SharedArrayBuffer(4)) };
  switch_ring.notes = new Float64Array(new SharedArrayBuffer(switch_ring.slots * 3 * 8));
  const switches_all = () => {
    const notes = switch_log.slice();
    const n = Atomics.load(switch_ring.index, 0);
    const origin = performance.timeOrigin;
    for (let i = Math.max(0, n - switch_ring.slots); i < n; i++) {
      const at = (i % switch_ring.slots) * 3;
      notes.push([switch_ring.notes[at] - origin, "S", switch_ring.notes[at + 1], switch_ring.notes[at + 2]]);
    }
    return notes.sort((a, b) => a[0] - b[0]);
  };
  // ?switches=main on the page (globalThis.rv_query where there is no page): every switch through the main thread.
  const page_query = typeof location != "undefined" ? location.search : (globalThis.rv_query || "");
  const switches_main = /[?&]switches=main(&|$)/.test(page_query);

  /// Interrupts the host raises (WASM_IRQ_INPUT 2, WASM_IRQ_NET 3: something was put into a ring): the bit in
  /// the word of the kernel's IRQ_CPU, and a notify, as the kernel's raise_interrupt() does. A Worker has put
  /// the word's address into doorbell[0] (0: not yet, or a kernel that takes no such interrupts).
  /// The account of translated code (16): [0] the budget in KiB, [1] the sum of the cells, then a cell for each
  /// Worker that has one. A cell is handed out with the Worker and given back, zeroed, when the Worker is ended.
  const JIT_CELLS = 8192;
  const jit_code = new Int32Array(new SharedArrayBuffer(4 * (2 + JIT_CELLS)));
  {
    const query = typeof location != "undefined" ? location.search : (globalThis.rv_query || "");
    const asked = /[?&]jitcode=([0-9]+)(&|$)/.exec(query);
    jit_code[0] = (asked ? Number(asked[1]) : 1536) * 1024;
    // (31) Firefox: 192 MiB of translated code (counted as the engine's cap takes it, linux-worker.js), not V8's 1536.
    if (!asked && typeof navigator != "undefined" && /Firefox\//.test(navigator.userAgent || "")) {
      jit_code[0] = 192 * 1024;
    }
  }
  const jit_cells_free = [];
  for (let i = JIT_CELLS - 1; i >= 0; i--) {
    jit_cells_free.push(i);
  }
  /// The console's input (17): typed bytes wait in a ring in shared memory until the kernel's console driver
  /// takes them; index[0] counts the bytes put in, index[1] those taken out. What does not fit waits in
  /// input_buffer, and goes in when there is room (the next key, or the driver says it has made room).
  const console_in = {
    bytes: new Uint8Array(new SharedArrayBuffer(1 << 20)),
    index: new Int32Array(new SharedArrayBuffer(8)),
  };
  const console_in_fill = () => {
    const size = console_in.bytes.length;
    const written = Atomics.load(console_in.index, 0);
    const room = size - ((written - Atomics.load(console_in.index, 1)) | 0);
    const pending = new Uint8Array(input_buffer);
    const n = Math.min(room, pending.length);
    if (n <= 0) {
      return;
    }
    const at = written & (size - 1);
    const first = Math.min(n, size - at);
    console_in.bytes.set(pending.subarray(0, first), at);
    console_in.bytes.set(pending.subarray(first, n), 0);
    input_buffer = pending.slice(n).buffer;
    Atomics.store(console_in.index, 0, (written + n) | 0);
  };

  /// (25) Where the sound card's header is (sound/drivers/wasm_audio.c: wasm_audio_header()), as a Worker found it;
  /// 0 until then, and for good with a kernel without the card. The page's player reads it through os.audio.
  const audio_where = new BigUint64Array(new SharedArrayBuffer(8));
  const doorbell = new BigUint64Array(new SharedArrayBuffer(8));
  const IRQ_INPUT = 2, IRQ_NET = 3;
  const raise_irq = (irq) => {
    const at = Number(Atomics.load(doorbell, 0));
    if (at) {
      const buffer = memory.buffer;
      Atomics.or(new BigInt64Array(buffer, at, 1), 0, 1n << BigInt(irq));
      Atomics.notify(new Int32Array(buffer, at, 1), 0, 1);
    }
  };

  const runner_name_of = (task) => (runner_names[task] || "a task without a runner") + " [" + task + "]";
  // ?runners=old on the page: the two things put right below are left as they were (to compare against).
  const runners_fixed = !(typeof location != "undefined" && /[?&]runners=old(&|$)/.test(location.search));

  /// Callbacks from Web Workers (each one representing one task).
  const message_callbacks = {
    start_primary: (message) => {
      // CPU 0 has init_task which sits in static storage. After booting it becomes CPU 0's idle task. The runner will
      // in this special case tell us where it is so that we can register it.
      log("Starting cpu 0 with init_task " + message.init_task)
      tasks[message.init_task] = cpus[0];
    },

    start_secondary: (message) => {
      if (message.cpu <= 0) {
        throw new Error("Trying to start secondary cpu with ID <= 0");
      }

      log("Starting cpu " + message.cpu + " (" + message.idle_task + ")");
      switch_note("U", message.cpu, message.idle_task);
      make_cpu(message.cpu, message.idle_task);
    },

    stop_secondary: (message) => {
      if (message.cpu <= 0) {
        // If you arrive here, you probably got panic():ed with a broken stack.
        if (!confirm("Trying to stop secondary cpu with ID 0.\n\n" +
          "You probably got panic():ed with a broken stack. Continue?\n\n" +
          " (Say ok if you know what you are doing and want to catch the panic, otherwise cancel.)")) {
          throw new Error("Trying to stop secondary cpu with ID 0");
        }
      }

      switch_note("X", message.cpu, 0);
      if (cpus[message.cpu]) {
        log("[Main]: Stopping CPU " + message.cpu);
        cpus[message.cpu].worker.terminate();
        delete cpus[message.cpu];
      } else {
        log("[Main]: Tried to stop CPU " + message.cpu + " but it was already stopped (broken system)!");
      }
    },

    create_and_run_task: (message) => {
      switch_note("C", message.prev_task, message.new_task);
      if (!tasks[message.prev_task]) {
        log("[Main]: create_and_run_task " + message.prev_task + " -> " + message.new_task + ": the task switched from has no runner");
      } else if (!tasks[message.prev_task].running) {
        log("[Main]: create_and_run_task " + message.prev_task + " -> " + message.new_task + ": " + runner_name_of(message.prev_task) + " is held not to be running");
      }

      // ret_from_fork will make sure the task switch finishes.
      make_task(message.prev_task, message.new_task, message.name, message.user_executable);

      // The task that made the switch stops, as in serialize_tasks below. (It was not accounted for here: a dying
      // task whose last switch was to a new task kept its Worker, blocked in serialize_me(), for good.)
      // (Not when the Workers switch by themselves: the task that made the switch may well run again, and
      // its Worker says when it is done, task_done.)
      if (runners_fixed && !message.direct && tasks[message.prev_task]) {
        tasks[message.prev_task].running = false;
        if (tasks[message.prev_task].kill) {
          kill_task(message.prev_task);
        }
      }
    },

    task_done: (message, worker) => {
      // A dead task's Worker has made its last switch (linux-worker.js: switch_wait): it can be ended once the
      // task is released, which may have happened already. (Only if that Worker is still the one registered for
      // the address: a new task made at the same address has a runner of its own, and the old one was ended.)
      switch_note("D", message.task, 0);
      const task = tasks[message.task];
      if (task && task.worker === worker) {
        task.running = false;
        if (task.kill) {
          kill_task(message.task);
        }
      }
    },

    end_user_task: (message) => {
      // (21) A fatal signal for a task that runs its program, which never comes into the kernel by itself. Its state
      // word goes from KILL (2) to ENDING (3) here, or the task has entered the kernel meanwhile (and takes the signal
      // there). Then its Worker is ended, and a new one runs the task to its exit (wasm_user_task_end).
      const word = new Int32Array(memory.buffer, Number(message.state), 1);
      if (Atomics.compareExchange(word, 0, 2, 3) != 2) {
        return;
      }
      switch_note("K", message.task, 2);
      const old = tasks[message.task];
      if (old) {
        old.worker.terminate();
      }
      const name = runner_names[message.task] || ("task " + message.task);
      log("[Main]: " + name + " has a fatal signal and runs its program: its Worker is ended, and a new one takes the task to its exit");
      tasks[message.task] = make_vmlinux_runner(name + " (ending)", { runner_type: "task_end", task: message.task });
    },

    release_task: (message) => {
      switch_note("R", message.dead_task, 0);
      if (!tasks[message.dead_task]) {
        log("[Main]: release_task " + message.dead_task + ": no runner");
        return;
      }
      kill_task(message.dead_task);
    },

    serialize_tasks: (message) => {
      // next_task was previously suspended, wake it up.
      switch_note("S", message.prev_task, message.next_task);
      if (!tasks[message.next_task] || !tasks[message.prev_task]) {
        log("[Main]: serialize_tasks " + message.prev_task + " -> " + message.next_task + ": "
            + (tasks[message.prev_task] ? "" : "the task switched from has no runner; ")
            + (tasks[message.next_task] ? "" : "the task switched to has no runner"));
        return;
      }
      if (tasks[message.next_task].running) {
        log("[Main]: serialize_tasks " + message.prev_task + " -> " + message.next_task + ": " + runner_name_of(message.next_task) + " is held to be running already");
      }
      if (!tasks[message.prev_task].running) {
        log("[Main]: serialize_tasks " + message.prev_task + " -> " + message.next_task + ": " + runner_name_of(message.prev_task) + " is held not to be running");
      }

      // Tell the next task where we switched from, so that it can finish the task switch.
      tasks[message.next_task].last_task[0] = message.prev_task;

      tasks[message.prev_task].running = false;
      tasks[message.next_task].running = true;

      // Release the above write of last_task and wake up the task.
      lock_notify(tasks[message.next_task].locks, "serialize");

      // In case the task was dying, we're now done. prev_task will wait in serialize_me() but never be scheduled again.
      if (tasks[message.prev_task].kill) {
        kill_task(message.prev_task);
      }
    },

    console_read: (message, worker) => {
      const memory_u8 = new Uint8Array(memory.buffer);
      const buffer = new Uint8Array(input_buffer);

      const used = buffer.slice(0, message.count);
      memory_u8.set(used, message.buffer);

      const unused = buffer.slice(message.count);
      input_buffer = unused.buffer;

      // Tell the Worker that asked for input how many bytes (perhaps 0) were actually written.
      Atomics.store(message.console_read_messenger, 0, used.length);
      Atomics.notify(message.console_read_messenger, 0, 1);
    },

    fb_show: (message) => {
      fb = { pixels: message.pixels, width: message.width, height: message.height, stride: message.stride };
    },

    net_tx: (message) => {
      if (net_socket && net_socket.readyState == WebSocket.OPEN) {
        net_socket.send(message.frame);
      }
    },

    dl_load: (message) => {
      // (26) A Worker loaded a library: how it got the module ("compile": it compiled one, and this is it).
      if (message.module && !dl_modules.has(message.key)) {
        dl_modules.set(message.key, message.module);
      }
      dl_log.push({ key: message.key, how: message.how, size: message.size, us: message.us, runner: message.runner });
      if (dl_log.length > 20000) {
        dl_log.splice(0, 10000);
      }
    },

    jit_module: (message) => {
      // (29) A Worker installed a batch: how it got the module ("compile": it compiled one, and this is it).
      const kib = Math.ceil(message.size * 3.5 / 1024);
      if (message.program) {
        jit_log[message.how == "compile" ? "program_compiles" : "program_hits"]++;
      } else if (message.how == "compile") {
        jit_log.compiles++;
        jit_log.compile_us += message.us;
        jit_log.bytes_compiled += message.size;
      } else {
        jit_log.hits++;
        jit_log.hit_us += message.us;
        jit_log.bytes_hit += message.size;
      }
      if (!jit_share) {
        return;
      }
      const have = jit_modules.get(message.key);
      if (have) {
        jit_modules.delete(message.key);  // (the newest)
        jit_modules.set(message.key, have);
      } else if (message.module) {
        jit_modules.set(message.key, message.module);
        jit_kib.set(message.key, kib);
        jit_kept_kib += kib;
        while (jit_kept_kib > jit_keep_kib && jit_modules.size > 1) {
          const oldest = jit_modules.keys().next().value;
          jit_modules.delete(oldest);
          jit_kept_kib -= jit_kib.get(oldest) || 0;
          jit_kib.delete(oldest);
          jit_log.evicted++;
        }
      }
    },

    kernel_crashed: (message) => {
      // A Worker threw inside the kernel (linux-worker.js, wasm_error): kept for the tools that read the machine.
      switch_note("E", 0, 0);
      kernel_crashes.push(message.runner_name + ": " + message.error);
    },

    console_room: () => {
      console_in_fill();
    },

    console_write: (message) => {
      console_write(message.message);
    },

    log: (message) => {
      log(message.message);
    },
  };

  /// For each disk, the words shared with its worker (see disk-worker.js), or null if there is no such disk.
  const disks = [];

  /// (26) Dynamic libraries (linux-worker.js): on with ?dl=1 on the page (globalThis.rv_query under node-machine). The
  /// libraries compiled so far, by content key, one WebAssembly.Module each for the whole page: every Worker that
  /// compiles one tells us (dl_load), and every task starts with all of them (init, assign), so V8 has one copy of a
  /// library's code however many programs and threads use it. dl_log is what happened, for tests and tools.
  const dl_enabled = rv_dl_wanted(typeof location != "undefined" ? location.search : (globalThis.rv_query || ""), typeof navigator != "undefined" ? navigator.userAgent : "");
  const dl_modules = new Map();
  /// (27) Programs compiled once per page (linux-worker.js): on in Firefox, where the engine does not share the code
  /// of identical modules and caps all the code of a process at 2 GiB; ?share=1 turns it on elsewhere, ?share=0 off.
  const share_search = typeof location != "undefined" ? location.search : (globalThis.rv_query || "");
  const share_programs = !/[?&]share=0(&|$)/.test(share_search) &&
    (/[?&]share=1(&|$)/.test(share_search) || (typeof navigator != "undefined" && /Firefox\//.test(navigator.userAgent || "")));
  const dl_log = [];
  const dl_stats = () => {
    const per = {};
    for (const entry of dl_log) {
      const e = per[entry.key] = per[entry.key] || { size: entry.size, compile: 0, shared: 0, preload: 0, compile_us: 0, shared_us: 0, preload_us: 0 };
      e[entry.how]++;
      if (entry.how == "preload") {
        e.preload_us += entry.us;
      } else if (entry.how == "compile") {
        e.compile_us += entry.us;
      } else if (entry.how == "shared") {
        e.shared_us += entry.us;
      }
    }
    return per;
  };
  /// Compile libraries ahead of any program (the page knows them: a manifest of {key, url} or {key, bytes}). A url is
  /// compiled as it streams in (WebAssembly.compileStreaming), which is what lets the browser keep the compiled code
  /// with the HTTP cache for the next visit; the key is the library's tools/dl-hash.py key.
  const dl_preload = async (entries) => {
    await Promise.all(entries.map(async (entry) => {
      if (dl_modules.has(entry.key)) {
        return;
      }
      const t0 = performance.now();
      let module;
      if (entry.bytes) {
        module = await WebAssembly.compile(entry.bytes);
      } else if (typeof WebAssembly.compileStreaming == "function") {
        module = await WebAssembly.compileStreaming(fetch(entry.url));
      } else {
        module = await WebAssembly.compile(await (await fetch(entry.url)).arrayBuffer());
      }
      if (!dl_modules.has(entry.key)) {
        dl_modules.set(entry.key, module);
      }
      dl_log.push({ key: entry.key, how: "preload", size: entry.size || 0, us: Math.round((performance.now() - t0) * 1000), runner: "main" });
    }));
  };

  /// (28) Fetch and compile a library as it streams in, then let the Module go: only the browser's HTTP cache and its code cache keep
  /// it (the next launch that needs it, or the next visit, finds it compiled). For the page's background job, for libraries it does
  /// not keep a Module of (a Module in the page is code space for good). A key that is loaded already is not fetched again.
  const dl_warm = async (entry) => {
    if (dl_modules.has(entry.key)) {
      return;
    }
    if (typeof WebAssembly.compileStreaming == "function") {
      await WebAssembly.compileStreaming(fetch(entry.url));
    } else {
      await (await fetch(entry.url)).arrayBuffer();
    }
  };

  /// The page's manifest of libraries (tools/dl-manifest.py's libs.json at url; each library's url is relative to it):
  /// the ones not marked "preload": false are compiled now, together. Resolves when all are done.
  const dl_preload_manifest = async (url) => {
    const manifest = await (await fetch(url)).json();
    const base = new URL(url, typeof location != "undefined" ? location.href : undefined);
    await dl_preload(manifest.libs.filter((lib) => lib.preload !== false).map((lib) => (
      { key: lib.key, url: new URL(lib.url, base).href, size: lib.size })));
  };

  /// (29) Compiled batches of translated regions (linux-worker.js, __rv_jit_install), by content key, one
  /// WebAssembly.Module each for the whole page: every Worker that compiles one tells us (jit_module), and every task
  /// starts with all of them (init, assign), so a program started again finds its batches compiled, with the
  /// engine's optimized code in them. What is kept is bounded (?jitkeep=MB, an estimate of the engine's code for
  /// them: 3.5 times their length; 256 if not said), the batch used least lately going first. ?jitshare=0 turns
  /// it off. ?jitgate=N lets at most N Workers compile at a time (0, the default: any number).
  const jit_search = typeof location != "undefined" ? location.search : (globalThis.rv_query || "");
  const jit_query = (name) => { const m = jit_search.match(new RegExp("[?&]" + name + "=([0-9]+)(&|$)")); return m ? Number(m[1]) : null; };
  /// (31) Firefox (see tools/patch-runtime.py 31): batches of translated code are not shared by content or kept, unless ?jitshare=1.
  const firefox_code_cap = typeof navigator != "undefined" && /Firefox\//.test(navigator.userAgent || "");
  const jit_share = jit_query("jitshare") === null ? !firefox_code_cap : jit_query("jitshare") !== 0;
  const jit_keep_kib = (jit_query("jitkeep") === null ? 256 : jit_query("jitkeep")) * 1024;
  const jit_gate = new Int32Array(new SharedArrayBuffer(8));
  jit_gate[0] = jit_query("jitgate") || 0;
  const jit_modules = new Map();
  const jit_kib = new Map();
  let jit_kept_kib = 0;
  const jit_log = { program_hits: 0, program_compiles: 0, hits: 0, compiles: 0, hit_us: 0, compile_us: 0, evicted: 0, bytes_hit: 0, bytes_compiled: 0 };
  /// Memory shared between all CPUs.
  const memory = new WebAssembly.Memory({
    initial: Ulong(30), // TODO: extract this automatically from vmlinux.
    // Cap maximum WebAssembly.Memory to 4 GiB (0x10000 pages) to prevent 16 GiB V8 VirtualAlloc exhaustion
    // and STATUS_ACCESS_VIOLATION / STATUS_STACK_OVERFLOW renderer crashes on host systems with multiple open tabs.
    maximum: Ulong(0x10000),
    shared: true,
    address: 'i' + arch_bits,
  });

  /**
   * Create and run one CPU in a background thread (a Web Worker).
   *
   * This will run boot code for the CPU, and then drop to run the idle task. For CPU 0 this involves booting the entire
   * system, including bringing up secondary CPUs at the end, while for secondary CPUs, this just means some
   * book-keeping before dropping into their own idle tasks.
   */
  const make_cpu = (cpu, idle_task) => {
    const options = {
      runner_type: (cpu == 0) ? "primary_cpu" : "secondary_cpu",
      idle_task: idle_task,
    };

    if (cpu == 0) {
      options.boot_cmdline = boot_cmdline;
      options.initrd = initrd;
      initrd = null;  // allow gc
    }

    // idle_task is undefined for cpu 0, we will know it first when start_primary notifies us.
    const name = "CPU " + cpu + " [boot+idle]" + (cpu != 0 ? " (" + idle_task + ")" : "");

    const runner = make_vmlinux_runner(name, options);
    cpus[cpu] = runner;
    if (idle_task) {
      runner_names[idle_task] = name;
    }
    if (cpu != 0) {
      tasks[idle_task] = runner; // For CPU 0, start_primary does this registration for us.
    }
  };

  /// Runners kept ready for the next tasks: Workers that have loaded their script and instantiated vmlinux, which
  /// together is most of the time it takes to create a task. Filled when the first task is created.
  const spare_runners = [];
  const SPARE_RUNNERS = 8;

  /**
   * Create and run one task. This task has been switch_to():ed by the scheduler for the first time.
   *
   * In the beginning, all tasks are serialized and have to cooperate to schedule eachother, but after secondary CPUs
   * are brought up, they can run concurrently (and will effectively be managed by the Wasm host OS). While we are not
   * able to suspend them from JS, the host OS will do that.
   */
  const make_task = (prev_task, new_task, name, user_executable) => {
    const options = {
      runner_type: "task",
      prev_task: prev_task,
      new_task: new_task,
      user_executable: user_executable,
    };
    const runner_name = name + " (" + new_task + ")";

    // A task_struct's address comes round again when the kernel reuses the memory of a task that is gone. A runner
    // still registered for it is a Worker the kernel has forgotten about: say so, and end it.
    if (tasks[new_task]) {
      const old = tasks[new_task];
      log("[Main]: task " + new_task + " (" + runner_name + ") is made while " + runner_name_of(new_task)
          + " is still registered (running " + old.running + ", kill " + old.kill + ")" + (runners_fixed ? ": that Worker is terminated" : ""));
      if (runners_fixed) {
        old.worker.terminate();
        delete tasks[new_task];
      }
    }
    runner_names[new_task] = runner_name;

    // Use a spare runner if there is one: it has started and instantiated vmlinux already.
    const spare = spare_runners.shift();
    if (spare) {
      spare.worker.postMessage({ ...options, method: "assign", runner_name: runner_name,
                                 jit_modules: jit_share ? jit_modules : null,
                                 dl_modules: dl_enabled || share_programs ? dl_modules : null, share_programs: share_programs });
      tasks[new_task] = spare;
    } else {
      tasks[new_task] = make_vmlinux_runner(runner_name, options);
    }

    // Replace it (after the hand-over above: this is not on the new task's critical path).
    while (spare_runners.length < SPARE_RUNNERS) {
      spare_runners.push(make_vmlinux_runner("spare", { runner_type: "spare" }));
    }
  };

  const kill_task = (dead_task) => {
    const task = tasks[dead_task];
    switch_note("K", dead_task, task.running ? 1 : 0);
    if (task.running) {
      // Case 1: current task is killing itself => we know that the reaped task is currently running (probably kthread).
      //
      // We need to delay killing the worker as it's still running. There is still some code for it to run, and
      // importantly, it needs to notify the next task to run on the CPU in serialize_me(). If the worker was
      // terminated before it was scheduled out, the dead task could deadlock its CPU on tasks[???].locks["serialize"].
      task.kill = true;
    } else {
      // Case 2: current task reaped another task => we know that the reaped task is not running. (kill == false).
      // Case 3: we get here from Case 1 as it eventually scheduled out, calling serialize_me(). (kill == true).
      task.worker.terminate();
      delete tasks[dead_task];
    }
  };

  /// Create a runner for vmlinux. It will run in a Web Worker and execute some specified code.
  const make_vmlinux_runner = (name, options) => {
    // Note: SharedWorker does not seem to allow WebAssembly Module or Memory instances posted.
    const worker = new Worker(worker_url, { name: name });
    // Its cell in the account of translated code, given back when the Worker is ended (from wherever that is).
    const jit_cell = jit_cells_free.length ? jit_cells_free.pop() : -1;
    if (jit_cell >= 0) {
      const terminate = worker.terminate.bind(worker);
      let ended = false;
      worker.terminate = () => {
        if (!ended) {
          ended = true;
          Atomics.sub(jit_code, 1, Atomics.exchange(jit_code, 2 + jit_cell, 0));
          jit_cells_free.push(jit_cell);
        }
        return terminate();
      };
    }

    let locks = {
      serialize: 0,
    };
    locks._memory = new Int32Array(new SharedArrayBuffer(Object.keys(locks).length * 4));

    // Store for last task when wasm_serialize() returns in switch_to(). Needed for each task, both normal ones and each
    // CPUs idle tasks (first called init_task (PID 0), not to be confused with init (PID 1) which is a normal task).
    const last_task = new Uint32Array(new SharedArrayBuffer(4));

    worker.onerror = (error) => {
      // (30) A bare Event (no message) is a Worker that could not start: its script was not loaded.
      if (!(error && error.message)) {
        log("[Main]: a task's Worker (" + name + ") could not start: its script was not loaded");
      }
      throw error;
    };

    worker.onmessage = (message_event) => {
      const data = message_event.data;
      message_callbacks[data.method](data, worker);
    };

    worker.onmessageerror = (error) => {
      throw error;
    };

    worker.postMessage({
      ...options,
      method: "init",
      variant: variant,
      vmlinux: vmlinux,
      memory: memory,
      locks: locks,
      net: net,
      input: input,
      disks: disks,
      jit_cache: jit_cache && jit_cache.buffer && jit_cache.program ? jit_cache : null,
      last_task: last_task,
      runner_name: name,
      switches_main: switches_main,
      switch_ring: switch_ring,
      doorbell: doorbell,
      audio_where: audio_where,
      console_in: console_in,
      jit_code: jit_code,
      jit_cell: jit_cell,
      dl: dl_enabled,
      dl_modules: dl_enabled || share_programs ? dl_modules : null,
      share_programs: share_programs,
      jit_modules: jit_share ? jit_modules : null,
      jit_share: jit_share,
      jit_gate: jit_gate.buffer,
      sigfix_off: typeof location != "undefined" && /[?&]sigfix=0(&|$)/.test(location.search),
      signals_old: typeof location != "undefined" && /[?&]signals=old(&|$)/.test(location.search),
    });

    return {
      worker: worker,
      locks: locks,
      last_task: last_task,
      running: true,
      kill: false,
    };
  };

  // The disks (drivers/block/wasm_blk.c), if the page wants any: disk_options is one of these, or a list of
  // them (wda, wdb, ...): { worker: the URL of disk-worker.js, url: where the pieces of the disk's image are,
  // name: what to call it in the origin's private file system, reset: forget what is kept there, keep: the
  // disk is the image only the first time, and its own from then on }. A worker of its own keeps each; the
  // kernel starts when they are ready.
  const disk_workers = [];
  await Promise.all([].concat(disk_options || []).map((options, index) => new Promise((resolve) => {
    const label = "[Disk " + options.name + "]: ";
    const control = new Int32Array(new SharedArrayBuffer(64));
    const disk_worker = new Worker(options.worker, { name: "disk " + options.name });
    disk_workers.push(disk_worker);
    disks[index] = null;
    disk_worker.onmessage = (event) => {
      if (event.data.method == "log") {
        log(label + event.data.text);
      } else {
        if (event.data.method == "ready") {
          disks[index] = control;
        } else {
          log(label + "no disk (" + event.data.text + ")");
        }
        resolve();
      }
    };
    disk_worker.onerror = (error) => {
      log(label + "no disk (" + error.message + ")");
      resolve();
    };
    disk_worker.postMessage({
      memory: memory,
      control: control,
      url: options.url,
      keep: options.keep,
      name: options.name,
      reset: options.reset,
    });
  })));

  // Create the primary cpu, it will later on callback to us and we start secondaries.
  make_cpu(0);

  return {
    /// For looking at a machine that has stopped answering (tools/desktop-drive.js): its memory, and the words
    /// each disk shares with its worker.
    memory: memory,
    disks: disks,
    get switches() { return switches_all(); },
    // Translated code as the account has it (16), in KiB: the budget, the sum, and the Workers that have some.
    get jit_code() {
      let workers = 0;
      for (let i = 0; i < JIT_CELLS; i++) {
        workers += Atomics.load(jit_code, 2 + i) > 0 ? 1 : 0;
      }
      return { budget: Atomics.load(jit_code, 0), sum: Atomics.load(jit_code, 1), workers: workers };
    },
    /// (25) The sound card, for the page's player (tools/www/audio.js): where its header is in the memory, and the
    /// word in which the host raises the kernel's interrupts (WASM_IRQ_AUDIO is one); 0 while not known.
    audio: {
      header: () => Number(Atomics.load(audio_where, 0)),
      irq_word: () => Number(Atomics.load(doorbell, 0)),
    },
    /// (26) Dynamic libraries: whether they are on, the content keys of the modules compiled so far, what happened
    /// (stats(): per key how many Workers compiled it, took it from the page's, and the time), and preload().
    dl: { enabled: dl_enabled, keys: () => [...dl_modules.keys()], stats: dl_stats, log: dl_log, preload: dl_preload, preload_manifest: dl_preload_manifest, warm: dl_warm },
    /// (29) Compiled batches: what the page keeps (keys), and what the Workers did (hits, compiles, microseconds).
    jit: { keys: () => [...jit_modules.keys()], kept_kib: () => jit_kept_kib, stats: () => ({ ...jit_log, kept: jit_modules.size, kept_kib: jit_kept_kib }),
           gate: jit_gate },
    runner_names: runner_names,
    kernel_crashes: kernel_crashes,
    runners: tasks,

    /// An input event as the canvas would make it: (0, key code, 1 or 0), (1, x, y) with both in 0..32767,
    /// (2, button code, 1 or 0), (3, 0, wheel clicks).
    screen_input: input_event,

    key_input: (data) => {
      const key_buffer = text_encoder.encode(data);  // Possibly UTF-8 (up to 16 bits).

      // Append key_buffer to the end of input_buffer.
      const old_size = input_buffer.byteLength;
      input_buffer = input_buffer.transfer(old_size + key_buffer.byteLength);
      (new Uint8Array(input_buffer)).set(key_buffer, old_size);
      console_in_fill();
    },

    terminate: () => {
      for (const cpu of Object.values(cpus)) {
        try { if (cpu && cpu.worker) cpu.worker.terminate(); } catch {}
      }
      for (const t of Object.values(tasks)) {
        try { if (t && t.worker) t.worker.terminate(); } catch {}
      }
      for (const dw of disk_workers) {
        try { if (dw) dw.terminate(); } catch {}
      }
    }
  };
};

if (typeof window !== "undefined") {
  window.linux = linux;
}
if (typeof globalThis !== "undefined") {
  globalThis.linux = linux;
}
