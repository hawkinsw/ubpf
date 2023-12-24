import { generate_ubpf_dispatch_system, load_runtime, Ubpf } from "./ubpf.ts";

import { malloc } from "./ubpf_utils.ts";

import Context from "https://deno.land/std@0.206.0/wasi/snapshot_preview1.ts";
import { decodeHex } from "https://deno.land/std/encoding/hex.ts";

function unwind(
  a0: bigint,
  _a1: bigint,
  _a2: bigint,
  _a3: bigint,
  _a4: bigint,
): bigint {
  return BigInt(a0);
}

function no_op(
  _a0: bigint,
  _a1: bigint,
  _a2: bigint,
  _a3: bigint,
  _a4: bigint,
): bigint {
  return BigInt(0);
}

function gather_bytes(
  a0: bigint,
  a1: bigint,
  a2: bigint,
  a3: bigint,
  a4: bigint,
): bigint {
  const result = ((a0 & BigInt(0xff)) << BigInt(32)) |
    ((a1 & BigInt(0xff)) << BigInt(24)) |
    ((a2 & BigInt(0xff)) << BigInt(16)) |
    ((a3 & BigInt(0xff)) << BigInt(8)) |
    ((a4 & BigInt(0xff)) << BigInt(0));
  return result;
}

function generate_memfrob(memory: ArrayBuffer) {
  return function (
    a0: bigint,
    a1: bigint,
    a2: bigint,
    a3: bigint,
    a4: bigint,
  ): bigint {
    const view8 = new DataView(memory, Number(a0), Number(a1));

    for (let i = 0; i < a1; i++) {
      let v = view8.getUint8(i);
      v ^= 42;
      view8.setUint8(i, v);
    }

    return BigInt(0);
  };
}

function generate_strcmp(memory: ArrayBuffer) {
  return function (
    a0: bigint,
    a1: bigint,
    a2: bigint,
    a3: bigint,
    a4: bigint,
  ): bigint {
    const a0view8 = new DataView(memory, Number(a0));
    const a1view8 = new DataView(memory, Number(a1));

    for (let i = 0; i < memory.byteLength; i++) {
      if (
        a0view8.getUint8(i) == 0 &&
        a1view8.getUint8(i) == 0
      ) {
        return BigInt(0);
      }
      if (a0view8.getUint8(i) == a1view8.getUint8(i)) {
        continue;
      }
      if (a0view8.getUint8(i) < a1view8.getUint8(i)) {
        return BigInt(-1);
      }
      return BigInt(1);
    }
    return BigInt(0);
  };
}

async function main() {
  const context = new Context({
    args: Deno.args,
    env: Deno.env.toObject(),
  });

  // Leave for a later upgrade
  const debug = false;
  const [ubpf_register, ubpf_dispatcher] = generate_ubpf_dispatch_system();

  const importObject = {
    wasi_snapshot_preview1: context.exports,
    env: {
      ubpf_dispatcher: ubpf_dispatcher,
    },
  };

  const result = await load_runtime(importObject);
  if (result instanceof Error) {
    console.error(`There was an error loading the ubpf runtime: ${result}`);
    return;
  }
  const [wasm, memory] = result;
  const memory_buffer = memory.buffer;

  const ubpf = new Ubpf(wasm, memory);

  let initial_program_memory_d = new Uint8Array(0);

  const argv = Deno.args;
  if (argv[0] != "--" && argv[0].length != 0) {
    // By spec we have a memory block to read!
    const initial_raw_memory = argv[0].replaceAll(" ", "");
    initial_program_memory_d = decodeHex(initial_raw_memory);
  }
  // We don't care about any other CLI options at this point.

  const raw_program_decoder = new TextDecoder();
  const raw_program = raw_program_decoder.decode(
    await Deno.readAll(Deno.stdin),
  );
  if (debug) {
    console.log(raw_program.replaceAll(" ", ""));
  }
  const program_bytes_d = decodeHex(
    raw_program.replaceAll(" ", "").replaceAll("\n", ""),
  );

  ubpf.SetUnwindIndex(5);
  const memfrob = generate_memfrob(memory_buffer);
  const strcmp = generate_strcmp(memory_buffer);
  ubpf_register(wasm, ubpf, 0, gather_bytes);
  ubpf_register(wasm, ubpf, 1, memfrob);
  ubpf_register(wasm, ubpf, 2, no_op);
  ubpf_register(wasm, ubpf, 4, strcmp);
  ubpf_register(wasm, ubpf, 5, unwind);

  const program_bytes_loc = malloc(wasm, program_bytes_d.length);
  const program_bytes_data = new Uint8Array(
    memory_buffer,
    program_bytes_loc,
    program_bytes_d.length,
  );
  const program_bytes_view = new DataView(
    memory_buffer,
    program_bytes_loc,
    program_bytes_d.length,
  );
  program_bytes_data.set(program_bytes_d);

  const program_memory_loc = malloc(wasm, initial_program_memory_d.length);
  const program_memory_data = new Uint8Array(
    memory_buffer,
    program_memory_loc,
    initial_program_memory_d.length,
  );
  const program_memory_view = new DataView(
    memory_buffer,
    program_memory_loc,
    initial_program_memory_d.length,
  );

  program_memory_data.set(initial_program_memory_d);

  const [load_result, load_error] = ubpf.LoadProgram(program_bytes_view);
  if (!load_result) {
    console.log(`Failed to load code: ${load_error}`);
    Deno.exit(1);
  }
  if (debug) {
    console.log(`load_result: ${load_result}`);
  }

  const exec_actual_result = ubpf.Execute(
    program_memory_view,
  );
  if (exec_actual_result instanceof Error) {
    console.log(`ubpf_exec failed: ${exec_actual_result}`);
  } else {
    console.log(`${exec_actual_result.toString(16)}`);
  }
  Deno.exit(0);
}

await main();
