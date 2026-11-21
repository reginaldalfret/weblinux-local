// SPDX-License-Identifier: GPL-2.0-only

(function (console) {
  // (Not the global object itself: a JavaScript program may take from it what only a browser's worker has.)
  let port = { postMessage: self.postMessage.bind(self) };
  let variant;
  let arch_bits;
  let Ulong;
  let memory = null;  // Note: memory.buffer has to be re-accessed after growing the memory!
  let locks = null;

  /// For each disk, the words shared with its worker (see disk-worker.js), or null if there is no such disk.
  let disks = [];

  /// For telling what was wrong when a signal's handler cannot be called (18): how many programs this Worker has
  /// loaded, the size of the one it runs, and whether it began as a spare runner.
  let programs_loaded = 0;
  let program_size = 0;
  let was_spare = false;
  let null_page_said = false;
  /// Whether the program running here has musl's old __libc_handle_signal (18; see wasm_load_executable).
  let old_signal_read = true;
  /// ?sigfix=0 on the page: 18 and 19 do nothing but look (no signal delivered by the runtime, no slot refused, no
  /// thread stack moved), for telling whether they are what a fault is about.
  let sigfix_off = false;
  /// The slots of the program's own functions: the table as it was when the program was instantiated (18).
  let program_slots = 4096;

  /// The store of translated code (tools/www/jitcache.js has its layout), or null; the SHA-256 (hex) of the program
  /// that may use it; and whether the program running now is that one (see wasm_load_executable).
  let jit_cache = null;
  let jit_cache_program = null;
  let jit_cache_ok = false;
  let user_executable_may_cache = null;

  /// (29) Modules of batches of translated regions by content key: the page's (the main thread's, at the time the task
  /// started: init, assign) and every one this Worker compiled (told to the main thread at once). Taking a module
  /// from here instead of compiling the same bytes again is what a program started twice, or by two processes, saves.
  let jit_shared = new Map();
  let jit_share = true;
  /// The bound on modules compiled at once, all Workers together: [0] how many may, 0 for any number, [1] how many are.
  let jit_gate = null;
  /// A content key of len bytes at address: three 32-bit lanes and the length. For one page, not cryptographic (the
  /// guest makes these bytes from its own code, in the memory it shares with everything else here).
  const jit_hash = (u8) => {
    const len = u8.length, words = Math.floor(len / 4);
    let h1 = 0x9e3779b9 | 0, h2 = 0x85ebca6b | 0, h3 = 0xc2b2ae35 | 0;
    const mix = (w, i) => {
      h1 = Math.imul(h1 ^ w, 0x9e3779b1);
      h1 ^= h1 >>> 15;
      h2 = Math.imul((h2 + w + i) | 0, 0x85ebca6b);
      h2 ^= h2 >>> 13;
      h3 = Math.imul(h3 ^ (w + Math.imul(i, 0x27d4eb2f)), 0x165667b1);
      h3 ^= h3 >>> 16;
    };
    if (u8.byteOffset % 4 == 0) {
      const u = new Uint32Array(u8.buffer, u8.byteOffset, words);
      for (let i = 0; i < words; i++) {
        mix(u[i], i);
      }
    } else {
      const view = new DataView(u8.buffer, u8.byteOffset, len);
      for (let i = 0; i < words; i++) {
        mix(view.getUint32(4 * i, true), i);
      }
    }
    if (len % 4) {
      let t = 0;
      for (let k = 0; k < len % 4; k++) {
        t |= u8[4 * words + k] << (8 * k);
      }
      mix(t >>> 0, words);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16) ^ len, 0x7feb352d);
    h2 = Math.imul(h2 ^ (h2 >>> 16) ^ h1, 0x846ca68b);
    h3 = Math.imul(h3 ^ (h3 >>> 15) ^ h2, 0x2c1b3c6d);
    return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0") +
      (h3 >>> 0).toString(16).padStart(8, "0") + "-" + len;
  };
  const jit_key = (address, len) => jit_hash(new Uint8Array(memory.buffer, address, len));
  /// A program's module (the emulator's own, the one every process of the machine runs): compiled once for the page,
  /// by content, and kept by the page, so that a process started after the last one has ended (a program opened
  /// again) is given a module whose code the engine has already compiled and optimized. Programs over 8 MB (native
  /// Qt programs: see 26) are left to the way they have.
  const jit_program_compile = (bytes) => {
    if (!jit_share || bytes.length > 8 * 1048576) {
      return WebAssembly.compile(bytes);
    }
    const key = "program:" + jit_hash(bytes);
    const have = jit_shared.get(key);
    if (have) {
      port.postMessage({ method: "jit_module", key: key, how: "hit", size: bytes.length, us: 0, program: true });
      return Promise.resolve(have);
    }
    const t0 = performance.now();
    return WebAssembly.compile(bytes).then((module) => {
      if (!jit_shared.has(key)) {
        jit_shared.set(key, module);
      }
      port.postMessage({ method: "jit_module", key: key, how: "compile", size: bytes.length,
                         us: Math.round((performance.now() - t0) * 1000), module: module, program: true });
      return module;
    });
  };
  /// Compile bytes to a module, holding a place in the bound on compiling at once (the gate) while the engine does.
  const jit_compile = (bytes) => {
    if (!jit_gate || Atomics.load(jit_gate, 0) <= 0) {
      return new WebAssembly.Module(bytes);
    }
    // (A place held by a Worker that was ended while it compiled would be lost for good: waiting more than 2 s,
    // compile without one.)
    let held = false;
    for (let waited = 0; waited < 100; waited++) {
      const n = Atomics.load(jit_gate, 1);
      if (n < Atomics.load(jit_gate, 0)) {
        if (Atomics.compareExchange(jit_gate, 1, n, n + 1) == n) {
          held = true;
          break;
        }
      } else {
        Atomics.wait(jit_gate, 1, n, 20);
      }
    }
    try {
      return new WebAssembly.Module(bytes);
    } finally {
      if (held) {
        Atomics.sub(jit_gate, 1, 1);
        Atomics.notify(jit_gate, 1, 1);
      }
    }
  };

  /// The ring of input events, shared with the main thread (see linux.js), or null.
  let input = null;

  /// The ring of received network frames, shared with the main thread (see linux.js), or null.
  let net = null;
  const text_decoder = new TextDecoder("utf-8");
  const text_encoder = new TextEncoder();

  /// A string denoting the runner name (same as Worker name), useful for debugging.
  let runner_name = "[Unknown]";

  /// ?signals=old on the page (see wasm_user_mode_tail): a new signal's handler runs inside the old one's frames.
  let signals_old = false;

  /// Task switches without the main thread (see wasm_serialize_tasks), unless the page says ?switches=main.
  let switches_main = false;
  /// Where the main thread finds the kernel's IRQ_CPU interrupt word (see wasm_driver_input_rx), or null.
  // The account of translated code (16): the page's array, and which cell of it is this Worker's (-1: none).
  let jit_code = null;
  let jit_cell = -1;
  // What each slot of the program's table holds, as the account has it (KiB).
  const jit_sizes = new Map();
  // What was let go of since the engine was last nudged to collect it (KiB).
  let jit_released = 0;
  /// (31) Firefox: what a module of len bytes (a batch of regions) takes of the engine's 2044 MiB of code, in KiB: measured, see
  /// tools/patch-runtime.py 31 (blocks of 64 KiB, two at least).
  const firefox_code_cap = typeof navigator != "undefined" && /Firefox\//.test(navigator.userAgent || "");
  const firefox_module_kib = (len) => (len < 25000 ? 128 : len < 58000 ? 256 : len < 80000 ? 272 : 64 + Math.ceil(len * 3 / 1024));
  /// (31) Firefox: a module that does not compile for want of code space ("out of memory") may find it a moment later: the
  /// other Workers of a program starting are compiling too, and code that was let go is only freed when it has been collected.
  /// So it is tried again, for up to about 6 seconds, before the program (which dies when a library will not load) is told.
  const firefox_retry_wait = new Int32Array(new SharedArrayBuffer(4));
  const firefox_compile_retry = (compile) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return compile();
      } catch (error) {
        if (!firefox_code_cap || attempt >= 24 || !/out of memory/i.test(String(error))) {
          throw error;
        }
        if (attempt == 0 || attempt == 12) {
          log("[Firefox]: no code space for a module of the engine's 2044 MiB (" + error + "): trying again");
        }
        Atomics.wait(firefox_retry_wait, 0, 0, 250);
      }
    }
  };
  const firefox_compile_retry_async = async (compile) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await compile();
      } catch (error) {
        if (!firefox_code_cap || attempt >= 24 || !/out of memory/i.test(String(error))) {
          throw error;
        }
        if (attempt == 0 || attempt == 12) {
          log("[Firefox]: no code space for a program (" + error + "): trying again");
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  };
  const jit_account = (slot, kib) => {
    const before = jit_sizes.get(slot) || 0;
    if (kib) {
      jit_sizes.set(slot, kib);
    } else {
      jit_sizes.delete(slot);
    }
    if (jit_code && jit_cell >= 0 && kib != before) {
      // (The cell first: a Worker ended between the two leaves the sum short, never over.)
      Atomics.add(jit_code, 2 + jit_cell, kib - before);
      Atomics.add(jit_code, 1, kib - before);
    }
    // A module let go of (its slot emptied, or given another module: a batch's, say) is still there until the
    // engine collects garbage in this Worker, which it does when JavaScript here has allocated enough, and that
    // is little: the program is WebAssembly. So once 16 MiB worth of modules are no one's, an allocation that
    // counts: a large buffer, not touched, gone at once. (Measured under Node, 20000 modules one after another
    // in one slot: 48 MiB of code left, 8.5 with this.)
    if (before) {
      jit_released += before;
      if (jit_released >= 16384) {
        jit_released = 0;
        try {
          new ArrayBuffer(64 << 20);
        } catch (error) {
        }
      }
    }
  };
  // A new program (exec): the old one's table, and its modules, are no longer anyone's.
  const jit_account_reset = () => {
    for (const slot of [...jit_sizes.keys()]) {
      jit_account(slot, 0);
    }
  };
  /// The console's input (17): a ring of bytes the main thread fills and the console driver empties, or null.
  let console_in = null;
  let doorbell = null;
  /// The ring of switches all Workers share, for the book (linux.js): index[0] counts notes, each note is
  /// [the time (ms since 1970, fractional), the task switched from, the task switched to].
  let switch_ring = null;
  /// A dead task's Worker waits on this for good: nobody wakes it, the main thread ends the Worker.
  const switch_never = new Int32Array(new SharedArrayBuffer(4));
  /// The clock for the notes, as it was when this Worker started (a JavaScript program may replace it).
  const switch_now = performance.now.bind(performance);
  const switch_origin = performance.timeOrigin;

  /// SAB-backed storage for last process in switch_to (when it returns back from another task).
  let switch_to_last_task = null;

  /// The vmlinux instance, to handle boot, idle, kthreads and syscalls etc.
  let vmlinux_instance = null;

  /// The user executable (if any) to run when we're not in vmlinux.
  let user_executable = null;
  let user_executable_params = null;
  // The size the program's import of its function table asks for (0: none), from its import section (23).
  const wasm_table_min = (bytes) => {
    let p = 8;
    const leb = () => {
      let result = 0, shift = 0, byte;
      do {
        byte = bytes[p++];
        result += (byte & 0x7f) * 2 ** shift;
        shift += 7;
      } while (byte & 0x80);
      return result;
    };
    const skip_limits = () => {
      const flags = bytes[p++];
      const min = leb();
      if (flags & 1) leb();
      return min;
    };
    try {
      while (p < bytes.length) {
        const id = bytes[p++];
        const size = leb();
        const end = p + size;
        if (id == 2) {
          for (let count = leb(); count > 0; count--) {
            for (let name = 0; name < 2; name++) {
              const length = leb();
              p += length;
            }
            const kind = bytes[p++];
            if (kind == 0) leb();
            else if (kind == 1) { p++; return skip_limits(); }
            else if (kind == 2) skip_limits();
            else if (kind == 3) p += 2;
            else if (kind == 4) { p++; leb(); }
          }
          return 0;
        }
        if (id > 2 && id != 0) return 0;
        p = end;
      }
    } catch (error) {
    }
    return 0;
  };

  /// The user executabe instance, or null. Try using the instance variable in the promise over this one if possible.
  let user_executable_instance = null;
  let user_executable_imports = null;
  /// (26) Dynamic libraries (docs/wasm-dynamic-linking.md). On with ?dl=1 on the page (globalThis.rv_query under
  /// node-machine): programs are then given __wasm_dl, and a new task calls its program's __dl_clone_hook before
  /// anything of its own runs. Off, nothing here is reached.
  let dl_on = false;
  /// What this Worker has loaded for its program: its main instance and the instances in load order.
  let dl_state = null;
  /// Compiled libraries by content key. The main thread's (linux.js) at the time the task started (the init or assign
  /// message), and every one this Worker compiled itself (told to the main thread at once). A WebAssembly.Module goes
  /// to another Worker by postMessage and V8 keeps one copy of its code: a library is compiled once per page.
  let dl_shared = new Map();
  /// (27) Programs compiled once per page, where the engine does not share the code of identical modules by itself
  /// (Firefox): a program is kept in dl_shared under "program:" and its content key. The page says (init, assign).
  let share_programs = false;
  /// The content key of len bytes at address: two 32-bit lanes (position dependent) and the length, as 8+8 hex digits
  /// and the length. A cache key for one page, not a cryptographic hash (tools/dl-hash.py computes the same).
  const dl_key = (address, len) => {
    const buffer = memory.buffer;
    const words = Math.floor(len / 4);
    let h1 = 0x9e3779b9 | 0, h2 = 0x85ebca6b | 0;
    const step = (w, i) => {
      h1 = Math.imul(h1 ^ w, 0x9e3779b1);
      h1 ^= h1 >>> 15;
      h2 = Math.imul((h2 + w + i) | 0, 0x85ebca6b);
      h2 ^= h2 >>> 13;
    };
    if (address % 4 == 0) {
      const u = new Uint32Array(buffer, address, words);
      for (let i = 0; i < words; i++) {
        const w = u[i];
        h1 = Math.imul(h1 ^ w, 0x9e3779b1);
        h1 ^= h1 >>> 15;
        h2 = Math.imul((h2 + w + i) | 0, 0x85ebca6b);
        h2 ^= h2 >>> 13;
      }
    } else {
      const view = new DataView(buffer);
      for (let i = 0; i < words; i++) {
        step(view.getUint32(address + 4 * i, true), i);
      }
    }
    if (len % 4) {
      const b = new Uint8Array(buffer, address + 4 * words, len % 4);
      let t = 0;
      for (let k = 0; k < b.length; k++) {
        t |= b[k] << (8 * k);
      }
      step(t >>> 0, words);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16) ^ len, 0x7feb352d);
    h2 = Math.imul(h2 ^ (h2 >>> 16) ^ h1, 0x846ca68b);
    return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0") + "-" + len;
  };

  /// A JavaScript program handed over by __run_js (see there), or null.
  let js_program = null;

  /// What the kernel's callbacks need of the browser, as it was when this Worker started: a JavaScript program
  /// shares the global object with this script, and such programs do replace what is there (clocks most of all).
  const host_performance_now = performance.now.bind(performance);
  const host_time_origin = performance.timeOrigin;
  const host_date_now = Date.now.bind(Date);
  const host_random_values = crypto.getRandomValues.bind(crypto);

  /// (20) What a trap of the program means as a signal: SIGFPE for arithmetic, SIGSEGV for a bad address (of data, of
  /// a function, the stack), SIGILL for the rest (unreachable, an error of the runtime).
  const trap_signal = (error) => {
    const text = String(error && error.message !== undefined ? error.message : error);
    if (error instanceof WebAssembly.RuntimeError &&
        /divide by zero|remainder by zero|divide result unrepresentable|float unrepresentable|integer overflow|invalid conversion to integer/.test(text)) {
      return 8;
    }
    if (error instanceof RangeError ||
        (error instanceof WebAssembly.RuntimeError &&
         /out of bounds|null function|signature mismatch|null pointer|invalid index into function table/.test(text))) {
      return 11;
    }
    return 4;
  };
  /// (20) How many traps in a row, a handler's own included: past a few, no handler is run any more.
  let fault_depth = 0;
  /// (22) A signal the kernel delivered at the task's first return to its program, before the program was there.
  let signal_at_start = false;

  /// Flag that a clone callback should be called instead of _start().
  let should_call_clone_callback = false;

  /// A messenger to synchronize with the main thread, as well as communicate how many bytes were read on the console.
  let console_read_messenger = new Int32Array(new SharedArrayBuffer(4));

  /// An exception type used to abort part of execution (useful for collapsing the call stack of user code).
  class Trap extends Error {
    constructor(kind) {
      super("This exception should be ignored. It is part of Linux/Wasm host glue.");
      Error.captureStackTrace && Error.captureStackTrace(this, Trap);
      this.name = "Trap";
      this.kind = kind;
    }
  }

  const log = (message) => {
    port.postMessage({
      method: "log",
      message: "[Runner " + runner_name + "]: " + message,
    });
  };

  /// A signal's handler could not be called (18): say what the frame named, what the table has there, and which
  /// program this Worker runs. (Called after the trap, from the tail that delivered the signal.)
  const signal_trouble = (said, error) => {
    let what = "";
    if (said && !said.error) {
      const table = user_executable_imports && user_executable_imports.env.__indirect_function_table;
      let has;
      try {
        const entry = table.get(said.handler);
        has = entry ? "function " + entry.name + " with " + entry.length + " parameters" : "nothing";
      } catch (e) {
        has = "no such slot";
      }
      what = "signal " + said.sig + " (" + (said.siginfo ? "SA_SIGINFO" : "no SA_SIGINFO") + "), handler slot " +
        said.handler + (said.handler >= 4096 ? " (where translated code goes)" : "") + ", which has " + has +
        "; the table has " + (table ? table.length : "?") + " slots; the frame is at " + said.sp;
      // (The frame as it is now: if it is not what it was a moment before the call, something else wrote it.)
      try {
        const frame = new DataView(memory.buffer, said.sp, 32);
        what += "; the frame now says signal " + frame.getInt32(0, true) + ", info " + frame.getBigUint64(8, true) +
          ", handler " + frame.getBigUint64(24, true);
      } catch (e) {
        what += "; the frame cannot be read now";
      }
    } else {
      what = "the frame could not be read (" + (said && said.error) + ")";
    }
    log("signal handler crash (" + error.message + "): " + what + "; the program is the " +
        programs_loaded + "th this Worker loaded, " + program_size + " bytes, " +
        (typeof jit_cache_ok != "undefined" && jit_cache_ok ? "the emulator" : "not known to be the emulator") +
        "; the Worker " + (was_spare ? "began" : "did not begin") + " as a spare runner");
  };

  /// Get a JS string object from a (nul-terminated) C-string in a Uint8Array.
  const get_cstring = (memory, index) => {
    const memory_u8 = new Uint8Array(memory.buffer);
    let end;
    for (end = index; memory_u8[end]; ++end); // Find terminating nul-character.
    return text_decoder.decode(memory_u8.slice(index, end));
  };

  const lock_notify = (lock, count) => {
    Atomics.store(locks._memory, locks[lock], 1);
    Atomics.notify(locks._memory, locks[lock], count || 1);
  };

  const lock_wait = (lock) => {
    // Take the wake (1 -> 0); a wait that ends with nothing to take was a late notify of an older wake (14).
    while (Atomics.exchange(locks._memory, locks[lock], 0) == 0) {
      Atomics.wait(locks._memory, locks[lock], 0);
    }
  };

  const serialize_me = (task) => {
    // Wait for some other task or CPU to wake us up (again, if it was not a real switch: switch_woken_right).
    for (;;) {
      lock_wait("serialize");
      const from = switch_to_last_task[0];  // last_task was written by the caller just prior to waking.
      if (task === undefined || switch_woken_right(task, from)) {
        return from;
      }
    }
  };

  /// The words of a task's thread_info a switch to it goes through (the kernel's wasm_task_switch_area():
  /// switch_from, 8 bytes, then switch_word), 0 for a dead task, or -1: the old way (through the main thread).
  const switch_area = (task) => {
    const exports = vmlinux_instance && vmlinux_instance.exports;
    if (switches_main || arch_bits != 64 || !exports || !exports.wasm_task_switch_area) {
      return -1;
    }
    return Number(exports.wasm_task_switch_area(Ulong(task)));
  };

  const switch_note = (prev_task, next_task) => {
    if (switch_ring) {
      const n = Atomics.add(switch_ring.index, 0, 1);
      const at = (n % switch_ring.slots) * 3;
      switch_ring.notes[at] = switch_origin + switch_now();
      switch_ring.notes[at + 1] = prev_task;
      switch_ring.notes[at + 2] = next_task;
    }
  };

  /// Wake the task whose switch words are at `area`, telling it it was switched to from prev_task.
  const switch_wake = (area, prev_task) => {
    const buffer = memory.buffer;
    new BigUint64Array(buffer, area, 1)[0] = BigInt(prev_task);
    const word = new Int32Array(buffer, area + 8, 1);
    Atomics.store(word, 0, 1);
    Atomics.notify(word, 0, 1);
  };

  /// A dead task's last switch: the main thread hears it once, AFTER the next task has been woken (or made): the
  /// main thread may end this Worker as soon as it hears it. (A late task_done, after a new task was made at the
  /// same address, is told apart by the Worker it comes from: see linux.js.)
  let switch_done_said = false;
  const switch_done = (task) => {
    if (!switch_done_said) {
      switch_done_said = true;
      port.postMessage({ method: "task_done", task: task });
    }
  };

  /// Wait until some task switches to ours (whose words are at `area`), and return the task it came from. A
  /// task that is dead (area 0) is never switched to again: say so to the main thread, and wait for the end.
  const switch_wait = (area, prev_task) => {
    if (!area) {
      switch_done(prev_task);
      for (;;) {
        Atomics.wait(switch_never, 0, 0);
      }
    }
    for (;;) {
      const word = new Int32Array(memory.buffer, area + 8, 1);
      while (Atomics.exchange(word, 0, 0) == 0) {
        Atomics.wait(word, 0, 0);
      }
      const from = Number(new BigUint64Array(memory.buffer, area, 1)[0]);
      if (switch_woken_right(prev_task, from)) {
        return from;
      }
    }
  };

  /// After a Worker was woken to run its task: is the task its CPU's current task now (the kernel's
  /// wasm_task_switched_in)? A wake for a switch that did not happen (one that came twice) would make two Workers
  /// run as one CPU, which the kernel panics about ("Not the current task (switched to)"). Such a wake is said in
  /// the log, and the Worker waits again for the real one. True if all is well (or the kernel cannot tell).
  let switch_wrong_wakes = 0;
  const switch_woken_right = (task, from) => {
    const exports = vmlinux_instance && vmlinux_instance.exports;
    if (!exports || !exports.wasm_task_switched_in || exports.wasm_task_switched_in(Ulong(task))) {
      return true;
    }
    switch_wrong_wakes++;
    const curr = exports.wasm_task_cpu_curr ? Number(exports.wasm_task_cpu_curr(Ulong(task))) : 0;
    log("woken for a switch that did not happen (" + switch_wrong_wakes + "): task " + task + " (from " + from
        + "), its cpu's current task is " + curr + "; waiting again");
    return false;
  };

  /// (25) Where the main thread finds the sound card's header (see doorbell_advertise), or null.
  let audio_where = null;

  /// Tell the main thread where the kernel takes the interrupts the host raises (see linux.js: raise_irq).
  const doorbell_advertise = () => {
    if (doorbell && !Atomics.load(doorbell, 0) && vmlinux_instance && vmlinux_instance.exports.wasm_irq_cpu_word) {
      Atomics.store(doorbell, 0, BigInt(vmlinux_instance.exports.wasm_irq_cpu_word()));
    }
    // (25) And where the sound card's header is (sound/drivers/wasm_audio.c), for the page's player.
    if (audio_where && !Atomics.load(audio_where, 0) && vmlinux_instance && vmlinux_instance.exports.wasm_audio_header) {
      Atomics.store(audio_where, 0, BigInt(vmlinux_instance.exports.wasm_audio_header()));
    }
  };

  /// Callbacks from within Linux/Wasm out to our host code (cpu is not neccessarily ours).
  const host_callbacks = {
    /// Start secondary CPU.
    wasm_start_cpu: (cpu, idle_task) => {
      // New web workers cannot be spawned from within a Worker in most browsers. It can currently not be spawned from
      // within a SharedWorker in any browser. Do it on the main thread instead.
      port.postMessage({ method: "start_secondary", cpu: cpu, idle_task: idle_task });
    },

    /// Stop secondary CPU (rather abruptly).
    wasm_stop_cpu: (cpu) => {
      port.postMessage({ method: "stop_secondary", cpu: cpu });
    },

    /// Creation of tasks on our end. Runs them too.
    wasm_create_and_run_task: (prev_task, new_task, name, bin_start, bin_end, data_start, table_start) => {
      // Tell main to create the new task, and then run it for the first time!
      const prev_area = switch_area(prev_task);
      const direct = prev_area >= 0;
      if (direct) {
        switch_note(prev_task, new_task);
      }
      port.postMessage({
        method: "create_and_run_task",
        direct: direct,
        prev_task: prev_task,
        new_task: new_task,
        name: get_cstring(memory, name),

        // For user tasks, there is user code to load first before trying to run it.
        user_executable: bin_start ? {
          bin_start: bin_start,
          bin_end: bin_end,
          data_start: data_start,
          table_start: table_start,
        } : null,
      });

      // Serialize this (old) task.
      return direct ? switch_wait(prev_area, prev_task) : serialize_me(prev_task);
    },

    /// Remove a task created by wasm_create_and_run_task().
    wasm_release_task: (dead_task) => {
      // (21) An odd address: not a release, but a fatal signal for a task running its program (the task's address
      // + 1): the main thread ends that task's Worker and runs the task's exit in a new one.
      if (dead_task & 1) {
        const task = dead_task - 1;
        const exports = vmlinux_instance.exports;
        if (exports.wasm_task_user_state) {
          port.postMessage({ method: "end_user_task", task: task, state: Number(exports.wasm_task_user_state(Ulong(task))) });
        }
        return;
      }
      port.postMessage({
        method: "release_task",
        dead_task: dead_task,
      });
    },

    /// Serialization of tasks (idle tasks and before SMP is started).
    wasm_serialize_tasks: (prev_task, next_task) => {
      // Without the main thread: wake the next task's Worker ourselves, then wait for our turn.
      const next_area = switch_area(next_task);
      if (next_area > 0) {
        const prev_area = switch_area(prev_task);
        switch_note(prev_task, next_task);
        switch_wake(next_area, prev_task);
        return switch_wait(prev_area, prev_task);
      }

      // Notify the next task that it can run again.
      port.postMessage({
        method: "serialize_tasks",
        prev_task: prev_task,
        next_task: next_task,
      });

      // Serialize this (old) task.
      return serialize_me(prev_task);
    },

    /// Kernel panic. We can't proceed.
    wasm_panic: (msg) => {
      const message = "Kernel panic: " + get_cstring(memory, msg);
      console.error(message);
      log(message);

      // This will stop execution of the current task.
      throw new Trap("panic");
    },

    /// Dump a stack trace into a text buffer. (The exact format is implementation-defined and varies by browser.)
    wasm_dump_stacktrace: (stack_trace, max_size) => {
      try {
        throw new Error();
      } catch (error) {
        const memory_u8 = new Uint8Array(memory.buffer);
        const encoded = text_encoder.encode(error.stack).slice(0, max_size - 1);
        memory_u8.set(encoded, stack_trace);
        memory_u8[stack_trace + encoded.length] = 0;
      }
    },

    /// Replace the currently executing image (kthread spawning init, or user process) with a new user process image.
    wasm_load_executable: (bin_start, bin_end, data_start, table_start) => {
      programs_loaded++;
      program_size = Number(bin_end) - Number(bin_start);
      // (18) Was the program linked with the musl whose __libc_handle_signal reads info_param from address 12 (the
      // code of that read: global.get 0, i64.const 4, i64.const 8, i64.add, i64.load)? Only then does the runtime
      // deliver its signals itself; a program linked with the fixed musl is left to its own.
      {
        const code = new Uint8Array(memory.buffer, Number(bin_start), program_size);
        const look = [0x23, 0x80, 0x80, 0x80, 0x80, 0x00, 0x42, 0x04, 0x42, 0x08, 0x7c, 0x29, 0x03, 0x00];
        old_signal_read = false;
        for (let at = code.indexOf(look[0]); at >= 0 && at + look.length <= code.length; at = code.indexOf(look[0], at + 1)) {
          let k = 1;
          while (k < look.length && code[at + k] == look[k]) {
            k++;
          }
          if (k == look.length) {
            old_signal_read = true;
            break;
          }
        }
      }
      const user_bytes = new Uint8Array(memory.buffer).slice(bin_start, bin_end);
      // (29) Whether these bytes are the one program that may use the store of translated code (see __rv_jit_cache).
      user_executable_may_cache = jit_cache && jit_cache_program ?
        crypto.subtle.digest("SHA-256", user_bytes).then((digest) =>
          Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("") == jit_cache_program,
          () => false) : null;
      // (27) The same program is compiled once: by content, from the modules the page has, else here and told to the page.
      const program_key = share_programs ? "program:" + dl_key(Number(bin_start), program_size) : null;
      const program_have = program_key ? dl_shared.get(program_key) : undefined;
      if (program_have) {
        user_executable = Promise.resolve(program_have);
        port.postMessage({ method: "dl_load", key: program_key, how: "shared", size: program_size, runner: runner_name, us: 0 });
      } else {
        user_executable = firefox_compile_retry_async(() => jit_program_compile(user_bytes));
        if (program_key) {
          user_executable.then((module) => {
            if (!dl_shared.has(program_key)) {
              dl_shared.set(program_key, module);
            }
            port.postMessage({ method: "dl_load", key: program_key, how: "compile", size: program_size, runner: runner_name,
                               us: 0, module: module });
          }, () => {});
        }
      }
      user_executable_params = {
        data_start: data_start,
        table_start: table_start,
        table_min: wasm_table_min(user_bytes),
      };

      // We release our reference already, just to be sure. The promise chain will still have a reference until the
      // kernel exits back to userland, which will termintate the user executable with a Trap.
      user_executable_instance = null;
      user_executable_imports = null;
    },

    /// Handle user mode return (e.g. from syscall) that should not proceed normally. (Not called on normal returns.)
    wasm_user_mode_tail: (flow) => {
      if (flow == -1) {
        // Exec has been called and we should not return from the syscall. Trap() to collapse the call stack of the user
        // executable. When swallowed, run the new user executable that was already preloaded by wasm_load_executable().
        // This takes precedence of signal handlers or signal return - no reason to run any old user code!
        throw new Trap("reload_program");
      } else if (flow >= 1 && flow <= 3) {
        // (22) A new task's first return to its program (ret_from_fork), with a signal to deliver, comes before
        // the program is instantiated: the handler runs when it is (user_executable_run).
        if (flow == 1 && !user_executable_instance) {
          signal_at_start = true;
          return;
        }
        // A signal return (a handler's sigreturn, 2): the handler is done, and its frames on the native stack, which
        // nothing can restore the way sigreturn restores the program's stack, are unwound by a Trap caught by the tail
        // that started the handler. When the kernel has another signal to deliver at the same time (3), that tail
        // delivers it once the frames are gone (below), where the old handler was: so handlers that keep coming, a
        // sigreturn apart, run one after the other, not one inside the other. (They did run nested, until the native
        // stack ran out: rv's stop-the-world kick comes every 2 ms to a thread that has not parked yet, and a thread
        // on a starved CPU takes longer than that to return from anything.) ?signals=old: the old order.
        if ((flow & 2) && !signals_old) {
          const trap = new Trap("signal_return");
          trap.deliver = (flow & 1) != 0;
          throw trap;
        }
        if (flow & 1) {
          let deliver = true;
          while (deliver) {
            deliver = false;
            try {
              if (user_executable_instance.exports.__libc_handle_signal) {
                // Setup signal frame...
                user_executable_imports.env.__stack_pointer.value = vmlinux_instance.exports.get_user_stack_pointer();
                user_executable_instance.exports.__set_tls_base(vmlinux_instance.exports.get_user_tls_base());

                // (18) The frame, read here: musl's __libc_handle_signal reads its info_param from address 12
                // of memory (8 on wasm32) instead of the frame (a stray constant in src/signal/wasm/restore.S), so
                // it calls the handler right only while that word is 0 and the handler is one without SA_SIGINFO.
                // Otherwise the handler is called from here, as musl means to, and then rt_sigreturn made, as
                // musl's __restore_rt does.
                let frame_said = null;
                let musl_reads = 0n;
                try {
                  const sp = Number(user_executable_imports.env.__stack_pointer.value);
                  const at = arch_bits == 64 ? 8 : 4;
                  const view = new DataView(memory.buffer);
                  const word = (offset) => arch_bits == 64 ? view.getBigUint64(offset, true) : BigInt(view.getUint32(offset, true));
                  frame_said = { sp: sp, sig: view.getInt32(sp, true), info: word(sp + at), uc: word(sp + 2 * at),
                                 handler: Number(word(sp + 3 * at)) };
                  frame_said.siginfo = frame_said.info != 0n;
                  musl_reads = word(arch_bits == 64 ? 12 : 8);
                  if (old_signal_read && musl_reads != 0n && !null_page_said) {
                    null_page_said = true;
                    const words = [];
                    for (let k = 0; k < 8; k++) {
                      words.push(word(k * at).toString(16));
                    }
                    log("null page error: something wrote into the first bytes of memory (" + words.join(" ") +
                        "); signals are delivered by the runtime instead of musl from now on (18)");
                  }
                } catch (error) {
                  frame_said = { error: String(error) };
                }
                try {
                  if (frame_said.error || sigfix_off || !old_signal_read || (!frame_said.siginfo && musl_reads == 0n)) {
                    user_executable_instance.exports.__libc_handle_signal();
                  } else {
                    const handler = user_executable_imports.env.__indirect_function_table.get(frame_said.handler);
                    if (frame_said.siginfo) {
                      handler(frame_said.sig, Ulong(frame_said.info), Ulong(frame_said.uc));
                    } else {
                      handler(frame_said.sig);
                    }
                    // __restore_rt: rt_sigreturn (139) with the program's stack pointer and TLS base.
                    const tls = user_executable_instance.exports.__get_tls_base ?
                      user_executable_instance.exports.__get_tls_base() : vmlinux_instance.exports.get_user_tls_base();
                    vmlinux_instance.exports.wasm_syscall_0(user_executable_imports.env.__stack_pointer.value, tls, Ulong(139));
                  }
                } catch (error) {
                  if (!(error instanceof Trap) && /null function|signature mismatch/.test(String(error))) {
                    signal_trouble(frame_said, error);
                  }
                  throw error;
                }
                throw new Error("Wasm function __libc_handle_signal() returned (it should never return)!");
              } else {
                throw new Error("Wasm function __libc_handle_signal() not defined!");
              }
            } catch (error) {
              if (error instanceof Trap && error.kind == "signal_return") {
                // ...restore signal frame (or take up the next signal's, which the kernel has set up on the stack
                // the sigreturn restored).
                user_executable_imports.env.__stack_pointer.value = vmlinux_instance.exports.get_user_stack_pointer();
                user_executable_instance.exports.__set_tls_base(vmlinux_instance.exports.get_user_tls_base());
                deliver = error.deliver === true;
              } else {
                // Either a genuine error, or a Trap() from exec() (signal handlers are allowed to call exec()).
                throw error;
              }
            }
          }
        }

        if (flow & 2) {
          throw new Trap("signal_return");
        }
      } else {
        throw new Error("wasm_syscall_tail called with unknown kind");
      }
    },

    // After this line follows host callbacks used by various drivers. In the future, we may make drivers more
    // modularized and allow them to allocate certain resources, like host callbacks, IRQ numbers, even syscalls...

    // Host callbacks by the Wasm-default clocksource.

    wasm_cpu_clock_get_monotonic: (() => {
      // Every Worker has to tell the same time: the kernel has one clock and reads it wherever a task or a CPU
      // runs. timeOrigin + now() alone does not: now() stands still while the computer sleeps and timeOrigin is
      // the wall clock when the Worker started, so a Worker started after a sleep is ahead of one started before
      // it by the length of the sleep (and one started after the wall clock was set is off by that much). A
      // Worker whose clock has come apart from the wall clock, by more than rounding and the slow corrections a
      // wall clock gets can explain, follows the wall clock from then on: all of them do, so they agree again.
      let correction = 0;
      return () => {
        const now = host_time_origin + host_performance_now();
        const apart = host_date_now() - (now + correction);
        if (apart > 250 || apart < -250) {
          correction += apart;
        }
        // Convert this double in ms to u64 in us.
        // Modern browsers can on good days reach 5us accuracy, given that the platform supports it.
        return BigInt(Math.round(1000 * (now + correction))) * 1000n;
      };
    })(),

    // Host callbacks by the Wasm-default random number generator.
    wasm_random_get_bytes: (buffer, count) => {
      if (count > 0x10000) {
        return -1;
      }

      const data = new Uint8Array(count);
      host_random_values(data);
      new Uint8Array(memory.buffer).set(data, buffer);

      return count;
    },

    // Host callbacks used by the disk (drivers/block/wasm_blk.c).

    /// The size of disk number index in 512-byte sectors, or 0 if there is none.
    wasm_driver_blk_sectors: (index) => {
      const disk = disks[index];
      return disk ? (disk[9] >>> 0) + disk[10] * 4294967296 : 0;
    },

    /// Read (op 0) or write (op 1) sectors from or to the kernel's memory at buffer, or flush (op 2); which disk
    /// is in the bits of op from 8 up. The disk's worker does it (disk-worker.js, which has the meaning of the
    /// shared words); this task sleeps meanwhile.
    wasm_driver_blk_rw: (sector, buffer, count, op) => {
      const disk = disks[op >>> 8];
      if (!disk) {
        return -5;  // EIO
      }
      op &= 0xff;
      // One request at a time: word 0 is the lock.
      while (Atomics.compareExchange(disk, 0, 0, 1) != 0) {
        Atomics.wait(disk, 0, 1);
      }
      disk[3] = op;
      disk[4] = sector % 4294967296 | 0;
      disk[5] = Math.floor(sector / 4294967296);
      disk[6] = buffer % 4294967296 | 0;
      disk[11] = Math.floor(buffer / 4294967296);
      disk[7] = count;
      Atomics.store(disk, 2, 0);
      Atomics.store(disk, 1, 1);
      Atomics.notify(disk, 1);
      // (Until it is done: a late notify of an earlier request can end a wait early, see 14.)
      while (Atomics.load(disk, 2) == 0) {
        Atomics.wait(disk, 2, 0);
      }
      const result = disk[8];
      Atomics.store(disk, 0, 0);
      Atomics.notify(disk, 0, 1);
      return result;
    },

    // Host callbacks used by the display (drivers/video/fbdev/wasm_fb.c).

    /// The pixels to show are at this address from now on: the main thread does the showing.
    wasm_driver_fb_show: (pixels, width, height, stride) => {
      port.postMessage({ method: "fb_show", pixels: pixels, width: width, height: height, stride: stride });
    },

    // Host callbacks used by the keyboard and pointer (drivers/input/misc/wasm_input.c).

    /// Copy up to max waiting events (three 32-bit words each) into the kernel's buffer and return how many.
    wasm_driver_input_rx: (events, max) => {
      if (!input) {
        return 0;
      }
      doorbell_advertise();
      const out = new Int32Array(memory.buffer, events, max * 3);
      const written = Atomics.load(input.index, 0);
      let read = Atomics.load(input.index, 1);
      let count = 0;
      while (count < max && read != written) {
        const slot = (read % input.slots) * 3;
        out[count * 3] = input.words[slot];
        out[count * 3 + 1] = input.words[slot + 1];
        out[count * 3 + 2] = input.words[slot + 2];
        read = (read + 1) | 0;
        count++;
      }
      Atomics.store(input.index, 1, read);
      return count;
    },

    // Host callbacks used by the network interface (drivers/net/wasm_net.c).

    /// Send one Ethernet frame: the main thread has the connection.
    wasm_driver_net_tx: (frame, count) => {
      port.postMessage({
        method: "net_tx",
        frame: new Uint8Array(memory.buffer).slice(frame, frame + count),
      });
      return count;
    },

    /// Copy the next received frame into the kernel's buffer and return its length, or 0 if there is none.
    wasm_driver_net_rx: (buffer, size) => {
      if (!net) {
        return 0;
      }
      doorbell_advertise();
      const read = Atomics.load(net.index, 1);
      if (read == Atomics.load(net.index, 0)) {
        return 0;
      }
      const slot = (read % net.slots) * net.slot_size;
      const length = net.bytes[slot] | (net.bytes[slot + 1] << 8);
      const fits = length <= size;
      if (fits) {
        new Uint8Array(memory.buffer).set(net.bytes.subarray(slot + 2, slot + 2 + length), buffer);
      }
      Atomics.store(net.index, 1, (read + 1) | 0);
      return fits ? length : 0;
    },

    // Host callbacks used by the Wasm-default console driver.

    wasm_driver_hvc_put: (buffer, count) => {
      const memory_u8 = new Uint8Array(memory.buffer);

      port.postMessage({
        method: "console_write",
        message: text_decoder.decode(memory_u8.slice(buffer, buffer + count)),
      });

      return count;
    },

    wasm_driver_hvc_get: (buffer, count) => {
      // Straight from the ring (17): the main thread is not asked, and this CPU does not wait for it.
      if (console_in) {
        const size = console_in.bytes.length;
        const read = Atomics.load(console_in.index, 1);
        const waiting = (Atomics.load(console_in.index, 0) - read) | 0;
        const n = Math.max(0, Math.min(waiting, count));
        const at = read & (size - 1);
        const first = Math.min(n, size - at);
        const memory_u8 = new Uint8Array(memory.buffer);
        memory_u8.set(console_in.bytes.subarray(at, at + first), buffer);
        memory_u8.set(console_in.bytes.subarray(0, n - first), buffer + first);
        Atomics.store(console_in.index, 1, (read + n) | 0);
        if (n > 0 && waiting >= size / 2) {
          port.postMessage({ method: "console_room" });  // (more may be waiting on the main thread)
        }
        return n;
      }

      // Reset lock. Using .store() for the memory barrier.
      Atomics.store(console_read_messenger, 0, -1);

      // Tell the main thread to write any input into memory, up to count bytes.
      port.postMessage({
        method: "console_read",
        buffer: buffer,
        count: count,
        console_read_messenger: console_read_messenger,
      });

      // Wait for a response from the main thread about how many bytes were actually written, could be 0.
      while (Atomics.load(console_read_messenger, 0) == -1) {
        Atomics.wait(console_read_messenger, 0, -1);
      }
      let console_read_count = Atomics.load(console_read_messenger, 0);
      return console_read_count;
    },
  };

  /// Callbacks from the main thread.
  const message_callbacks = {
    init: (message) => {
      variant = message.variant;
      arch_bits = variant.startsWith("wasm32_") ? 32 : 64;
      Ulong = (arch_bits == 32) ? Number : BigInt;

      if (arch_bits == 64) {
        // Quick hack that truncates parameters to 32-bit Number, then upsamples them to BigInt. Ugly but works in practice for memories <4G.
        for (const method in host_callbacks) {
          const original = host_callbacks[method];
          host_callbacks[method] = function (...args) {
            const result = original(...args.map(Number));
            if (typeof result !== "undefined") {
              return BigInt(result);
            }
          };
        }
      }

      runner_name = message.runner_name;
      signals_old = message.signals_old === true;
      sigfix_off = message.sigfix_off === true;
      jit_shared = message.jit_modules || new Map();
      jit_share = message.jit_share !== false;
      jit_gate = message.jit_gate ? new Int32Array(message.jit_gate) : null;
      dl_on = message.dl === true;
      dl_shared = message.dl_modules || new Map();
      share_programs = message.share_programs === true;
      switches_main = message.switches_main === true;
      switch_ring = message.switch_ring || null;
      doorbell = message.doorbell || null;
      audio_where = message.audio_where || null;
      console_in = message.console_in || null;
      jit_code = message.jit_code || null;
      jit_cell = message.jit_cell === undefined ? -1 : message.jit_cell;
      memory = message.memory;
      locks = message.locks;
      net = message.net || null;
      input = message.input || null;
      disks = message.disks || [];
      jit_cache = (message.jit_cache && message.jit_cache.buffer) || null;
      jit_cache_program = (message.jit_cache && message.jit_cache.program) || null;
      switch_to_last_task = message.last_task; // Only defined for tasks and CPU 0 (init task).

      if (message.user_executable) {
        // We are in a new runner that should duplicate the user executable. Happens when someone calls clone().
        host_callbacks.wasm_load_executable(
          message.user_executable.bin_start,
          message.user_executable.bin_end,
          message.user_executable.data_start,
          message.user_executable.table_start);
      }

      let import_object = {
        env: {
          ...host_callbacks,
          memory: message.memory,
        },
      };

      // This is a global error handler that is used when calling Wasm code.
      const wasm_error = (error) => {
        // With where it happened: the functions of a program have names (its "name" section).
        log("Wasm crash: " + error.toString() + "\n" + String(error.stack || "").split("\n").slice(0, 14).join("\n"));
        console.error(error);

        if (vmlinux_instance) {
          // The program's fault, or the kernel's? The CPU's flags say: in user mode, the program threw, and the
          // kernel handles that as an exception of the program. Otherwise the error came out of the kernel itself,
          // in the middle of a system call or a task switch: whatever it holds is still held, and the task the
          // scheduler may already have woken for this CPU runs in its own Worker. Running the kernel again from here
          // would make two of them as one CPU (which is what "Syscall called when in kernel mode" was). Say so, and
          // let this Worker be: the machine will show the task as hung, which is what it is.
          const flags = vmlinux_instance.exports.wasm_cpuflags_now ? vmlinux_instance.exports.wasm_cpuflags_now() : 2;
          if (!(flags & 2)) {
            log("crashed INSIDE THE KERNEL (the cpu's flags are 0x" + flags.toString(16) + "): this Worker stops here; its task is lost");
            port.postMessage({ method: "kernel_crashed", runner_name: runner_name, error: error.toString() });
            return;
          }
          // (20) A trap of the program: the kernel makes a signal of it, whose handler runs on the way out of
          // wasm_user_fault, as at the return of a system call. A trap cannot be resumed: if the handler returns,
          // the program dies by the signal (-sig). Without the program's instance (it did not get to run) no
          // handler can run, nor in handler after handler that traps itself.
          const exports = vmlinux_instance.exports;
          if (exports.wasm_user_fault) {
            const sig = trap_signal(error);
            const sp = user_executable_imports ? user_executable_imports.env.__stack_pointer.value : exports.get_user_stack_pointer();
            const tls = user_executable_instance && user_executable_instance.exports.__get_tls_base ?
              user_executable_instance.exports.__get_tls_base() : exports.get_user_tls_base();
            const handler = user_executable_instance && fault_depth < 4;
            fault_depth++;
            try {
              if (handler) {
                exports.wasm_user_fault(sp, tls, Ulong(sig));
              }
              exports.wasm_user_fault(sp, tls, Ulong(-sig));
            } catch (next) {
              // The handler called exec (a Trap), or trapped itself (a trap again: its own signal is blocked there).
              return user_executable_error(next);
            }
            log("the kernel did not end a program that trapped (signal " + sig + ")");
            return;
          }
          vmlinux_instance.exports.raise_exception();
          throw new Error("raise_exception() returned");
        } else {
          // Only log stack if vmlinux is not up already - it will dump stacks itself.
          log(error.stack);
          throw error;
        }
      };

      const vmlinux_setup = () => {
        // Instantiate a vmlinux Wasm Module. This will implicitly run __wasm_init_memory, which will effectively:
        // * Copy all passive data segments into their (static) position.
        // * Clear BSS (in its static position).
        // * Drop all passive data segments.
        // An in-memory atomic flag ensures this only happens the first time vmlinux is instantiated on the main memory.
        return WebAssembly.instantiate(message.vmlinux, import_object).then((instance) => {
          vmlinux_instance = instance;
        });
      };

      const vmlinux_run = () => {
        if (message.runner_type == "primary_cpu") {
          // Notify the main thread about init task so that it knows where it resides in memory.
          port.postMessage({
            method: "start_primary",
            init_task: vmlinux_instance.exports.init_task.value,
          });

          // Setup the boot command line. We have the luxury to be able to write to it directly. The maximum length is
          // not set here but is set by COMMAND_LINE_SIZE (defaults to 512 bytes).
          const cmdline = message.boot_cmdline + "\0";
          const cmdline_buffer = Number(vmlinux_instance.exports.boot_command_line.value);
          new Uint8Array(memory.buffer).set(text_encoder.encode(cmdline), cmdline_buffer);

          // Grow the memory to fit initrd and copy it.
          //
          // All typed arrays and views on memory.buffer become invalid by growing and need to be re-created. grow()
          // will return the old size, which becomes our base address for initrd.
          if (arch_bits == 64) {
            const initrd_start = memory.grow(BigInt(((message.initrd.byteLength + 0xFFFF) / 0x10000) | 0)) * 0x10000n;
            const initrd_end = initrd_start + BigInt(message.initrd.byteLength);
            new Uint8Array(memory.buffer).set(new Uint8Array(message.initrd), Number(initrd_start));
            new DataView(memory.buffer).setBigUint64(Number(vmlinux_instance.exports.initrd_start.value), initrd_start, true);
            new DataView(memory.buffer).setBigUint64(Number(vmlinux_instance.exports.initrd_end.value), initrd_end, true);
          } else {
            const initrd_start = memory.grow(((message.initrd.byteLength + 0xFFFF) / 0x10000) | 0) * 0x10000;
            const initrd_end = initrd_start + message.initrd.byteLength;
            new Uint8Array(memory.buffer).set(new Uint8Array(message.initrd), initrd_start);
            new DataView(memory.buffer).setUint32(vmlinux_instance.exports.initrd_start.value, initrd_start, true);
            new DataView(memory.buffer).setUint32(vmlinux_instance.exports.initrd_end.value, initrd_end, true);
          }

          // This will boot the maching on the primary CPU. Later on, it will boot secondaries...
          //
          // _start sets up the Wasm global __stack_pointer to init_stack and calls start_kernel(). Note that this will
          // grow the memory and thus all views on memory.buffer become invalid.
          vmlinux_instance.exports._start();

          // _start() will never return, unless it fails to allocate all memoy it wants to.
          throw new Error("_start did not even succeed in allocating 16 pages of RAM, aborting...");
        } else if (message.runner_type == "secondary_cpu") {
          // start_secondary() will never return. It can be killed by terminate() on this Worker.
          vmlinux_instance.exports._start_secondary(Ulong(message.idle_task));

          throw new Error("start_secondary returned");
        } else if (message.runner_type == "task_end") {
          // (21) A task whose Worker the main thread ended: become it, and take it to its exit (does not return).
          vmlinux_instance.exports.wasm_user_task_end(Ulong(message.task));
          throw new Error("wasm_user_task_end returned");
        } else if (message.runner_type == "task") {
          // A fresh task, possibly serialized on CPU 0 before secondaries are brought up.
          should_call_clone_callback = vmlinux_instance.exports.ret_from_fork(Ulong(message.prev_task), Ulong(message.new_task));

          // Two cases exist when we reach here:
          // 1. The kthread that spawned init retuned.
          // The code will already have been loaded, just execute it.
          //
          // 2. Someone called clone.
          // We should call the clone callback on the user executable, which has already been loaded.
          //
          // Notably, we don't end up here after exec() syscalls. Instead, the user instance is reloaded directly.
          return;
        } else {
          throw new Error("Unknown runner_type: " + message.runner_type);
        }
      };

      const user_executable_setup = () => {
        jit_account_reset();
        const stack_pointer = vmlinux_instance.exports.get_user_stack_pointer();
        const tls_base = vmlinux_instance.exports.get_user_tls_base();

        user_executable_imports = {
          env: {
            memory: memory,
            __memory_base: new WebAssembly.Global({ value: 'i' + arch_bits, mutable: false }, Ulong(user_executable_params.data_start)),
            __stack_pointer: new WebAssembly.Global({ value: 'i' + arch_bits, mutable: true }, stack_pointer),
            __indirect_function_table: new WebAssembly.Table({
              initial: Math.max(4096, user_executable_params.table_min || 0), element: "anyfunc" }),
            __table_base: new WebAssembly.Global({ value: 'i' + arch_bits, mutable: false }, Ulong(user_executable_params.table_start)),
            __table_base32: new WebAssembly.Global({ value: 'i32', mutable: false }, Number(user_executable_params.table_start)),

            // To be correct, we should save AND restore these globals between the user instance and vmlinux instance:
            // __stack_pointer <-> __user_stack_pointer
            // __tls_base <-> __user_tls_base
            // The kernel interacts with them in the following ways:
            // * Diagnostics (reading them and displaying them in informational messages).
            // * ret_from_fork: writes stack and tls. We have to deal with it, but not here, as this is not a syscall!
            // * syscall exec: tls should be kept even if the process image is replaced (probably has no real use case).
            // * syscall clone: stack and tls should be transfered to the new instance, unless overridden.
            // * signal handlers: also not a syscall - vmlinux calls the host, perhaps during syscall return!
            // The kernel never modifies neither of them for the task that makes a syscall.
            //
            // To make syscalls faster (allowing them to not go through a slow JavaScript wrapper), we skip transferring
            // them back to the user instance. They always have to be transferred to vmlinux at syscall sites, as a
            // signal being handled in its return path would need to save (and restore) them on its signal stack.
            __wasm_syscall_0: vmlinux_instance.exports.wasm_syscall_0,
            __wasm_syscall_1: vmlinux_instance.exports.wasm_syscall_1,
            __wasm_syscall_2: vmlinux_instance.exports.wasm_syscall_2,
            __wasm_syscall_3: vmlinux_instance.exports.wasm_syscall_3,
            __wasm_syscall_4: vmlinux_instance.exports.wasm_syscall_4,
            __wasm_syscall_5: vmlinux_instance.exports.wasm_syscall_5,
            __wasm_syscall_6: vmlinux_instance.exports.wasm_syscall_6,

            // JIT support (rv/jit.c): compile the Wasm module the program built at
            // [ptr, ptr + len) and put its exported function "r" into the program's
            // function table, at `slot` or, if that is negative, in a new slot.
            // Function imports of the module (namespace "rv") are resolved against
            // the program's own exports, so generated code can call back into it.
            // Returns the slot, or -1 if the module did not compile.
            __rv_jit_install: (ptr, len, slot) => {
              try {
                // A length of 0 (16): with slot -2, the budget for translated code and what all Workers have,
                // in KiB, as budget << 32 | sum (0 << 32: no budget); with a slot, empty it.
                if (Number(len) == 0) {
                  if (Number(slot) == -2) {
                    const budget = jit_code ? Math.max(0, Atomics.load(jit_code, 0)) : 0;
                    const sum = jit_code ? Math.max(0, Atomics.load(jit_code, 1)) : 0;
                    return Ulong((BigInt(budget) << 32n) | BigInt(Math.min(sum, 0xffffffff)));
                  }
                  if (Number(slot) < program_slots && !sigfix_off) {
                    log("__rv_jit_install error: asked to empty slot " + slot + ", one of the program's own: refused (18)");
                    return Ulong(-1);
                  }
                  user_executable_imports.env.__indirect_function_table.set(Number(slot), null);
                  jit_account(Number(slot), 0);
                  return Ulong(slot);
                }
                const start = Number(ptr);
                // (29) A batch of regions is compiled once for the page, by content: the same batch made by another
                // process (the same program again) is the same bytes, so the module the page has is the one taken.
                const shared_key = jit_share && Number(slot) <= -16 ? jit_key(start, Number(len)) : null;
                let module = shared_key ? jit_shared.get(shared_key) : undefined;
                const how = module ? "hit" : "compile";
                const t0 = performance.now();
                if (!module) {
                  // A copy: a module cannot be compiled from shared memory.
                  const bytes = new Uint8Array(memory.buffer).slice(start, start + Number(len));
                  module = jit_compile(bytes);
                  if (shared_key) {
                    jit_shared.set(shared_key, module);
                  }
                }
                if (shared_key) {
                  port.postMessage({ method: "jit_module", key: shared_key, how: how, size: Number(len),
                                     us: Math.round((performance.now() - t0) * 1000), module: how == "compile" ? module : undefined });
                }
                // The table: regions jump to one another through it (tail calls).
                const imports = {
                  env: { memory: memory, table: user_executable_imports.env.__indirect_function_table },
                  rv: {},
                };
                for (const item of WebAssembly.Module.imports(module)) {
                  if (item.module == "rv") {
                    imports.rv[item.name] = user_executable_instance.exports[item.name];
                  }
                }
                // (A batch's slots follow it in memory: none of them may be one of the program's own.)
                if (Number(slot) <= -16) {
                  const slots = new DataView(memory.buffer, start + Number(len), 4 * (-16 - Number(slot)));
                  for (let i = 0; i < -16 - Number(slot); i++) {
                    if (slots.getUint32(4 * i, true) < program_slots && !sigfix_off) {
                      log("__rv_jit_install error: asked to put a region into slot " + slots.getUint32(4 * i, true) +
                          ", one of the program's own: refused (18)");
                      return Ulong(-1);
                    }
                  }
                }
                const instance = new WebAssembly.Instance(module, imports);
                const table = user_executable_imports.env.__indirect_function_table;
                // What a module takes of the engine's code space, about: three and a half times its length
                // (measured with rv's regions as made on the machine: Liftoff's code is 3.1 to 3.9 times as long
                // as the module, TurboFan's 3.5) and its jump tables, in pages of 16 KiB.
                const kib = firefox_code_cap ? firefox_module_kib(Number(len)) : Math.ceil((Number(len) * 7 / 2 + 2048) / 16384) * 16;
                // A batch (slot -16 - count): the module has put its functions into their slots itself, by its
                // element segments, when it was instantiated; the slots follow the module in memory.
                if (Number(slot) <= -16) {
                  const count = -16 - Number(slot);
                  const slots = new DataView(memory.buffer, start + Number(len), 4 * count);
                  for (let i = 0; i < count; i++) {
                    jit_account(slots.getUint32(4 * i, true), Math.ceil(kib / count));
                  }
                  return Ulong(0);
                }
                let index = Number(slot);
                if (index < 0) {
                  index = table.grow(1);
                } else if (index < program_slots && !sigfix_off) {
                  log("__rv_jit_install error: asked to put a region into slot " + index + ", one of the program's own: refused (18)");
                  return Ulong(-1);
                }
                table.set(index, instance.exports.r);
                jit_account(index, kib);
                return Ulong(index);
              } catch (error) {
                console.error("__rv_jit_install: " + error);
                return Ulong(-1);
              }
            },

            // JavaScript as a program (hostnode/): stop running this program, as exec does, and run the JavaScript
            // text at [ptr, ptr + len) as what this task does from now on (see js_program_run). arg is for the
            // text: where the program has put what it wants to tell it. Does not return.
            __run_js: (ptr, len, arg) => {
              const start = Number(ptr);
              js_program = {
                source: text_decoder.decode(new Uint8Array(memory.buffer).slice(start, start + Number(len))),
                arg: arg,
              };
              throw new Trap("run_js");
            },

            // (26) Dynamic libraries: op 0 load the module the descriptor at arg describes, 1 how many instances this
            // Worker has (the program's included), 2 the length of the function table. Only with ?dl=1.
            ...(dl_on ? { __wasm_dl: (op, arg) => {
              const table = user_executable_imports.env.__indirect_function_table;
              if (!dl_state || dl_state.main !== user_executable_instance) {
                dl_state = { main: user_executable_instance, instances: [user_executable_instance] };
              }
              const dl = dl_state;
              if (Number(op) == 1) {
                return Ulong(dl.instances.length - 1);
              } else if (Number(op) == 2) {
                return Ulong(table.length);
              }
              try {
                const view = new DataView(memory.buffer);
                const word = (address) => view.getBigUint64(Number(address), true);
                const cstring = (address) => get_cstring(memory, Number(address));
                const desc = Number(arg);
                const bytes = Number(word(desc)), len = Number(word(desc + 8));
                const nimports = Number(word(desc + 16)), plan = Number(word(desc + 24));
                const table_min = Number(word(desc + 32)), place = Number(word(desc + 40));
                if (table.length < table_min) {
                  table.grow(table_min - table.length);
                }
                let instance = dl.instances[Number(word(desc + 48))];
                const t0 = performance.now();
                let t1 = t0, t2 = t0;
                if (len) {
                  // The module: the page's, by content; else compiled here (a copy: a module cannot be compiled from
                  // shared memory) and given to the main thread for every task after this one. The key is hashed from the
                  // bytes by the first load and left in the descriptor (the program's log keeps it): a thread replaying
                  // the log reads it there instead of hashing megabytes again. (All programs share one memory and one
                  // kernel here; a program that lies about a key can do nothing it could not do anyway. A key that
                  // names nothing the page has is checked against the bytes before anything is compiled for it.)
                  const keyfield = new Uint8Array(memory.buffer, desc + 80, 32);
                  let key = "";
                  for (let k = 0; k < 32 && keyfield[k]; k++) {
                    key += String.fromCharCode(keyfield[k]);
                  }
                  let module = key ? dl_shared.get(key) : undefined;
                  let how = "shared";
                  if (!module) {
                    const actual = dl_key(bytes, len);
                    if (actual != key) {
                      key = actual;
                      module = dl_shared.get(key);
                    }
                    if (!module) {
                      how = "compile";
                      module = firefox_compile_retry(() => new WebAssembly.Module(new Uint8Array(memory.buffer).slice(bytes, bytes + len)));
                      dl_shared.set(key, module);
                    }
                    if (!keyfield[0] && key.length < 32) {
                      for (let k = 0; k < key.length; k++) {
                        keyfield[k] = key.charCodeAt(k);
                      }
                    }
                  }
                  port.postMessage({ method: "dl_load", key: key, how: how, size: len, runner: runner_name,
                                     us: Math.round((performance.now() - t0) * 1000), module: how == "compile" ? module : undefined });
                  const imports = {};
                  const wanted = WebAssembly.Module.imports(module);
                  if (wanted.length != nimports) {
                    throw new Error("the module has " + wanted.length + " imports, the descriptor binds " + nimports);
                  }
                  wanted.forEach((item, i) => {
                    const entry = plan + 32 * i;
                    const kind = Number(word(entry)), type = Number(word(entry + 8));
                    const a = word(entry + 16), b = word(entry + 24);
                    let value;
                    if (kind == 1) {
                      value = user_executable_imports.env[cstring(a)];
                    } else if (kind == 2) {
                      const i64 = (type & 0xff) == 0x7e;
                      value = new WebAssembly.Global({ value: i64 ? "i64" : "i32", mutable: !!(type & 0x100) },
                                                     i64 ? BigInt.asIntN(64, a) : Number(BigInt.asIntN(32, a)));
                    } else if (kind == 3) {
                      value = table.get(Number(a));
                    } else if (kind == 4) {
                      value = dl.instances[Number(a)].exports[cstring(b)];
                    } else if (kind == 5) {
                      const name = cstring(a);
                      value = () => { throw new WebAssembly.RuntimeError("undefined symbol: " + name); };
                    }
                    if (value === undefined || value === null) {
                      throw new Error("nothing to bind import " + item.module + "." + item.name + " to (kind " + kind + ")");
                    }
                    (imports[item.module] = imports[item.module] || {})[item.name] = value;
                  });
                  t1 = performance.now();
                  instance = new WebAssembly.Instance(module, imports);
                  t2 = performance.now();
                }
                if (place) {
                  let slot = place;
                  for (const value of Object.values(instance.exports)) {
                    if (typeof value == "function") {
                      table.set(slot++, value);
                    }
                  }
                }
                const t3 = performance.now();
                view.setBigUint64(desc + 56, BigInt(Math.round((t1 - t0) * 1000)), true);
                view.setBigUint64(desc + 64, BigInt(Math.round((t2 - t1) * 1000)), true);
                view.setBigUint64(desc + 72, BigInt(Math.round((t3 - (len ? t2 : t0)) * 1000)), true);
                dl.instances.push(len ? instance : null);
                return Ulong(dl.instances.length - 1);
              } catch (error) {
                log("__wasm_dl: " + error + "\n" + error.stack);
                return Ulong(-1);
              }
            } } : {}),
            // The store of translated code (rv/jitcache.c, tools/www/jitcache.js). op 0: the record of the
            // 16-byte key at `key` into [buf, buf + len); returns its length (more than len: nothing copied),
            // or -1 if there is none. op 1: keep [buf, buf + len) as the record of `key`; 0, or -1 if not kept
            // (there already is one, or the store is full). -2: there is no store, or not for this program.
            __rv_jit_cache: (op, key, buf, len) => {
              if (!jit_cache || !jit_cache_ok) {
                return Ulong(-2);
              }
              const words = new Int32Array(jit_cache);
              const bytes = new Uint8Array(jit_cache);
              const mem = new Uint8Array(memory.buffer);
              const k = Number(key), b = Number(buf), n = Number(len);
              const capacity = words[2], mask = capacity - 1, data_cap = words[3], index = 64, data = index + 32 * capacity;
              const find = () => {
                for (let i = (mem[k] | mem[k + 1] << 8 | mem[k + 2] << 16 | mem[k + 3] << 24) & mask, tries = 0;
                     tries < capacity; i = (i + 1) & mask, tries++) {
                  const at = index + 32 * i;
                  if (Atomics.load(words, (at >> 2) + 5) == 0) {
                    return -1 - i;  // an empty place: not there
                  }
                  let same = true;
                  for (let j = 0; j < 16 && same; j++) {
                    same = bytes[at + j] == mem[k + j];
                  }
                  if (same) {
                    return i;
                  }
                }
                return -1 - capacity;
              };
              if (Number(op) == 0) {
                const i = find();
                if (i < 0) {
                  return Ulong(-1);
                }
                const at = index + 32 * i, offset = words[(at >> 2) + 4], length = words[(at >> 2) + 5];
                if (length <= n) {
                  mem.set(bytes.subarray(data + offset, data + offset + length), b);
                  // (Used in this visit: for keeping what is used most lately, tools/www/jitcache.js compact().)
                  words[(at >> 2) + 6] = words[8];
                  Atomics.add(words, 9, 1);
                }
                return Ulong(length);
              }
              if (Number(op) != 1 || n <= 0) {
                return Ulong(-1);
              }
              // One writer at a time: word 1 is the lock. (Readers need none: a place's length is written last.)
              // A writer holds it for a copy, microseconds; one that waited 100 ms gives up and keeps nothing,
              // so that a lock left held (by a Worker ended while it held it) costs records, not a machine.
              for (let tries = 0; Atomics.compareExchange(words, 1, 0, 1) != 0; tries++) {
                if (tries == 100) {
                  return Ulong(-1);
                }
                Atomics.wait(words, 1, 1, 1);
              }
              let result = -1;
              const i = find();
              const used = words[4];
              if (i < 0 && i != -1 - capacity && 2 * (words[5] + 1) <= capacity && used + n <= data_cap) {
                const place = -1 - i, at = index + 32 * place;
                bytes.set(mem.subarray(b, b + n), data + used);
                bytes.set(mem.subarray(k, k + 16), at);
                words[(at >> 2) + 4] = used;
                words[(at >> 2) + 6] = words[8];
                Atomics.store(words, (at >> 2) + 5, n);
                words[4] = used + ((n + 7) & ~7);
                words[5]++;
                Atomics.add(words, 6, 1);
                result = 0;
              }
              Atomics.store(words, 1, 0);
              Atomics.notify(words, 1, 1);
              return Ulong(result);
            },
            __wasm_abort: () => {
              debugger
              throw WebAssembly.RuntimeError('abort');
            },
          },
        };

        // Instantiate a user Wasm Module. This will implicitly run __wasm_init_memory, which will effectively:
        // * Initialize the TLS pointer (to a data_start-relocated static area, for the first thread).
        // * Copy all passive data segments into their (data_start-relocated) position.
        // * Clear BSS (data_start-relocated).
        // * Drop all passive data segments (except the TLS region, which is saved, but unused in the musl case).
        // An atomic flag ensures this only happens for the first thread to be started (using instantiate).
        //
        // The TLS pointer will be initialized in the following way ways:
        // * kthread-returns-to-init: __user_tls_base would be 0 as it's zero-initialized on the kthreads switch_stack.
        //   (We are ignoring it.) __wasm_init_memory() would initialize it to the static area as described above.
        //
        // * exec: __user_tls_base should have been the value of the process calling exec (during the syscall). However,
        //   we would want to restore it as part of initializing the runtime, which is exactly what __wasm_init_memory()
        //   does. This also means that whatever value the task calling exec() supplied for tls is ignored.
        //
        // * clone: clone explicitly passes its tls pointer to the kernel as part of the syscall. Unless the tls pointer
        //   has been overridden with CLONE_SETTLS, it will be copied from the old task to the new one. This is mostly
        //   useful when CLONE_VFORK is used, in which case the new task can borrow the TLS until it calls exec or exit.
        let woken = user_executable.then(async (user_module) => {
          // (Only the program the page named may use the store of translated code: see __rv_jit_cache.)
          jit_cache_ok = user_executable_may_cache ? (await user_executable_may_cache) === true : false;
          return WebAssembly.instantiate(user_module, user_executable_imports);
        });

        woken = woken.then((instance) => {
          // A thread shares the memory of a program whose pointers were relocated when it started, and may
          // have changed since: applying the relocations again would put their first values back (24).
          if (!should_call_clone_callback) {
            instance.exports.__wasm_apply_data_relocs();
          }
          if (should_call_clone_callback) {
            // Note: __wasm_init_tls cannot be used as it would also re-initilize the _Thread_local variables' data. But
            // on a clone(), it is none of our business to do that. It's up to the libc to do that as part of pthreads.
            // Indeed, for example on a clone with CLONE_VFORK, the right thing to do may be to borrow the parent's TLS.
            // Unfortunately, LLVM does not export __tls_base directly on dynamic libraries, so we go through a wrapper.
            instance.exports.__set_tls_base(tls_base);
          }
          user_executable_instance = instance;
          program_slots = user_executable_imports.env.__indirect_function_table.length;
          return instance;
        });

        return woken;
      };

      const user_executable_run = (instance) => {
        if (signal_at_start) {
          // (22) The signal the kernel delivered before the program was there: its handler, before anything else.
          signal_at_start = false;
          host_callbacks.wasm_user_mode_tail(1);
        }
        if (should_call_clone_callback) {
          // We have to reset this state, because if the clone callback calls exec, we have to run _start() instead!
          should_call_clone_callback = false;

          if (instance.exports.__libc_clone_callback) {
            // (19) The function and its argument at the stack pointer, moved down so that what is left when
            // __libc_clone_callback() has taken them (16 bytes) is 16-byte aligned.
            if (arch_bits == 64) {
              const sp = user_executable_imports.env.__stack_pointer.value;
              const aligned = ((sp + 16n) & ~15n) - 16n;
              if (aligned != sp && !sigfix_off) {
                const view = new DataView(memory.buffer);
                const fn = view.getBigUint64(Number(sp), true), arg = view.getBigUint64(Number(sp) + 8, true);
                view.setBigUint64(Number(aligned), fn, true);
                view.setBigUint64(Number(aligned) + 8, arg, true);
                user_executable_imports.env.__stack_pointer.value = aligned;
              }
            }
            // (26) A new task loads its process's dynamic libraries before anything of its own runs.
            if (dl_on && instance.exports.__dl_clone_hook) {
              instance.exports.__dl_clone_hook();
            }
            instance.exports.__libc_clone_callback();
            throw new Error("Wasm function __libc_clone_callback() returned (it should never return)!");
          } else {
            throw new Error("Wasm function __libc_clone_callback() not defined!");
          }
        } else {
          if (instance.exports._start) {
            // Ideally libc would do this instead of the usual __init_array stuff (e.g. override __libc_start_init in
            // musl). However, a reference to __wasm_call_ctors becomes a GOT import in -fPIC code, perhaps rightfully
            // so with the current implementation and use case on LLVM. Anyway, we do it here, slightly early on...
            if (instance.exports.__wasm_call_ctors) {
              instance.exports.__wasm_call_ctors();
            }

            // TLS: somewhat incorrectly contains 0 instead of the TP before exec(). Since we will anyway not care about
            // its value (__wasm_apply_data_relocs() called would have overwritten it in this case) it does not matter.
            instance.exports._start();
            throw new Error("Wasm function _start() returned (it should never return)!");
          } else {
            throw new Error("Wasm function _start() not defined!");
          }
        }
      };

      // Run the JavaScript a program handed over with __run_js. The text is an expression for a function, which
      // is called once with what a process needs. It is called from here, a reaction to a promise, with nothing
      // of Wasm on the stack: when it returns, the jobs of the promises it made run, and what it has asked the
      // browser to call later is called later, so it can be a program with an event loop of its own. The Wasm
      // program stays instantiated: the kernel delivers signals to it (wasm_user_mode_tail), and its C library
      // is there to be called.
      const js_program_run = () => {
        const program = js_program;
        js_program = null;
        try {
          const main = (0, eval)(program.source);
          main({
            memory: memory,
            instance: user_executable_instance,
            stack_pointer: user_executable_imports.env.__stack_pointer,
            // (stack pointer, thread pointer, number, arguments...) => result, by the number of arguments.
            syscalls: [0, 1, 2, 3, 4, 5, 6].map((n) => vmlinux_instance.exports["wasm_syscall_" + n]),
            arg: program.arg,
            name: runner_name,
            log: log,
            // For what the text catches and cannot handle: a Trap of this script (exec, panic), or an error
            // that is the end of the program.
            error: user_executable_error,
          });
        } catch (error) {
          return user_executable_error(error);
        }
      };

      const user_executable_error = (error) => {
        if (error instanceof Trap) {
          if (error.kind == "reload_program") {
            // Someone called exec and the currently executing code should stop. We should run the new user code already
            // loaded by wasm_load_executable().
            return user_executable_chain();
          } else if (error.kind == "run_js") {
            return js_program_run();
          } else if (error.kind == "panic") {
            // This has already been handled - just swallow it. This Worker will be done - but kept for later debugging.
          } else {
            throw new Error("Unexpected Wasm host Trap " + error.kind);
          }
        } else {
          wasm_error(error);
        }
      };

      const user_executable_chain = () => {
        // user_executable_error() may deal with an exec() trap and recursively call run_chain() again.
        return user_executable_setup().then(user_executable_run).catch(user_executable_error);
      };

      // All tasks start in the kernel, some return to userland, where they should never return. If they return, we
      // handle this as an error and wait. Our life ends when the kernel kills us by terminating the whole Worker. Oh,
      // and exex() can trap us, in which case we have to circle back to loading new user code and executing it agian.
      if (message.runner_type == "spare") {
        // A spare runner (see linux.js): what does not depend on the task is done ahead of time, which is loading
        // this script and instantiating vmlinux. The task itself arrives later, in an "assign" message.
        const ready = vmlinux_setup();
        was_spare = true;
        message_callbacks.assign = (assignment) => {
          message = assignment;
          runner_name = message.runner_name;
          if (message.jit_modules) {
            jit_shared = message.jit_modules;  // (29) what the main thread has by now
          }
          if (message.dl_modules) {
            dl_shared = message.dl_modules;  // (26) what the main thread has compiled by now
          }
          share_programs = message.share_programs === true;
          if (message.user_executable) {
            host_callbacks.wasm_load_executable(
              message.user_executable.bin_start,
              message.user_executable.bin_end,
              message.user_executable.data_start,
              message.user_executable.table_start);
          }
          ready.then(vmlinux_run).catch(wasm_error).then(user_executable_chain);
        };
        return;
      }

      vmlinux_setup().then(vmlinux_run).catch(wasm_error).then(user_executable_chain);
    },
  };

  self.onmessage = (message_event) => {
    const data = message_event.data;
    message_callbacks[data.method](data);
  };

  self.onmessageerror = (error) => {
    throw error;
  };
})(console);
