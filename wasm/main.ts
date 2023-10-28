import {
  create_runtime,
  exec_ubpf,
  generate_ubpf_dispatch_system,
  set_unwind_index,
  load_runtime,
  load_ubpf,
  malloc,
} from "./ubpf.ts";

import Context from "https://deno.land/std/wasi/snapshot_preview1.ts";
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
  const result=((a0 & BigInt(0xff))<<BigInt(32)) |
               ((a1 & BigInt(0xff))<<BigInt(24)) |
               ((a2 & BigInt(0xff))<<BigInt(16)) |
               ((a3 & BigInt(0xff))<< BigInt(8)) |
               ((a4 & BigInt(0xff))<< BigInt(0))
  return result
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

  const vm = create_runtime(wasm);
  let initial_program_memory_d = new Uint8Array(0);

  const argv = Deno.args;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] != "--" && i == 0) {
      // By spec we have a memory block to read!
      const initial_raw_memory = argv[i].replaceAll(" ", "");
      initial_program_memory_d = decodeHex(initial_raw_memory);
    }
    // We don't care about any other CLI options at this point.
  }

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

  set_unwind_index(wasm, vm, 5);
  ubpf_register(wasm, vm, 0, gather_bytes);
  ubpf_register(wasm, vm, 5, unwind);
  ubpf_register(wasm, vm, 2, no_op);

  const program_bytes_loc = malloc(wasm, program_bytes_d.length);
  const program_bytes = new Uint8Array(
    memory_buffer,
    program_bytes_loc,
    program_bytes_d.length,
  );

  const program_memory_loc = malloc(wasm, initial_program_memory_d.length);
  const program_memory = new Uint8Array(
    memory_buffer,
    program_memory_loc,
    initial_program_memory_d.length,
  );

  program_memory.set(initial_program_memory_d);
  program_bytes.set(program_bytes_d);

  const [load_result, load_error] = load_ubpf(wasm, vm, program_bytes);
  if (!load_result) {
    console.log(`Failed to load code: ${load_error}`);
    Deno.exit(1)
  }
  if (debug) {
    console.log(`load_result: ${load_result}`);
  }
  const exec_actual_result = exec_ubpf(
    wasm,
    vm,
    memory_buffer,
    program_memory.byteOffset,
    program_memory.length,
  );
  if (exec_actual_result instanceof Error) {
    console.log(`ubpf_exec failed: ${exec_actual_result}`);
  } else {
    console.log(`${exec_actual_result.toString(16)}`);
  }
  Deno.exit(0)
}

await main();
