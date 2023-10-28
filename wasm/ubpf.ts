export class Vm {
  native_runtime: Pointer = NullPointer;
}
export type Pointer = number;
export const NullPointer: Pointer = 0;
export type UbpfPlatformSpecificHelperFunctionType = (
  p1: bigint,
  p2: bigint,
  p3: bigint,
  p4: bigint,
  p5: bigint,
) => bigint;
type RegisterFunctionType = (
  a: WebAssembly.Instance,
  b: Vm,
  c: number,
  d: UbpfPlatformSpecificHelperFunctionType,
) => void;
type DispatchFunctionType = (
  tag: number,
  p1: bigint,
  p2: bigint,
  p3: bigint,
  p4: bigint,
  p5: bigint,
) => bigint;

/**
 * Load the WASM runtime.
 *
 * @returns {Promise<[WebAssembly.Instance, WebAssembly.Memory], Error>} A promise to either the
 * error that occurred when loading the runtime or the pair of the instance of the wasm runtime
 * and its memory.
 */
export async function load_runtime(
  importObject: WebAssembly.Imports,
): Promise<[WebAssembly.Instance, WebAssembly.Memory] | Error> {
  try {
    const wasmSourceFile = await Deno.open("./bin/ubpf_lib.wasm");
    const wasmSource = await Deno.readAll(wasmSourceFile);
    return WebAssembly.instantiate(wasmSource, importObject).then(
      (result) => {
        return [
          result.instance,
          result.instance.exports.memory as WebAssembly.Memory,
        ];
      },
      (reason) => {
        return new Error(reason);
      },
    );
  } catch (_error) {
    return new Error("Could not find the wasm binary.");
  }
}

/**
 * Create a UBPF runtime.
 *
 * @param wasm {WebAssembly.Instance} The instance of the wasm runtime
 * @returns {Vm} A VM instance that can be used for future ubpf calls.
 */
export function create_runtime(wasm: WebAssembly.Instance): Vm {
  const ubpf_create = wasm.exports.ubpf_create as () => Pointer;
  const vm = ubpf_create();
  const runtime = new Vm();
  runtime.native_runtime = vm;
  return runtime;
}

function strlen(memory: Uint8Array, start: number): number {
  let result = 0;
  while (memory.at(start + result) != 0) {
    result++;
  }
  return result;
}

/**
 * Load a BPF program into UBPF.
 *
 * @param wasm {WebAssembly.Instance} The instance of the wasm runtime
 * @param {number} program Pointer to wasm memory of ebpf program to load
 */
export function load_ubpf(
  wasm: WebAssembly.Instance,
  vm: Vm,
  program: Uint8Array,
): [boolean, string] {
  const error_str_ptr_ptr = malloc(wasm, 8);
  const runtime_memory = (wasm.exports.memory as WebAssembly.Memory).buffer;
  const runtime_memory_view = new Uint8Array(runtime_memory);
  const error_str_ptr_ptr_view = new DataView(
    runtime_memory,
    error_str_ptr_ptr,
    8,
  );

  const ubpf_load = wasm.exports.ubpf_load as (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => number;

  const result = ubpf_load(
    vm.native_runtime,
    program.byteOffset,
    program.length,
    error_str_ptr_ptr,
  );
  if (result != 0) {
    const error_str_ptr = error_str_ptr_ptr_view.getBigUint64(0, true);
    const error_str_len = strlen(runtime_memory_view, Number(error_str_ptr));
    const error_str_ptr_view = new DataView(
      runtime_memory,
      Number(error_str_ptr),
      error_str_len,
    );
    const td = new TextDecoder();
    const error = td.decode(error_str_ptr_view)
    return [false, error];
  }
  return [true, "no error"];
}

export function exec_ubpf(
  wasm: WebAssembly.Instance,
  vm: Vm,
  runtime_memory: ArrayBuffer,
  program_memory_ptr: number,
  program_memory_length: number,
): bigint | Error {
  const exec_result_loc = malloc(wasm, 8);
  const exec_result = new DataView(runtime_memory, exec_result_loc, 8);

  const ubpf_exec = wasm.exports.ubpf_exec as (
    vm_ptr: number,
    program_memory_ptr: number,
    program_memory_length: number,
    result_ptr: number,
  ) => number;
  const result = ubpf_exec(
    vm.native_runtime,
    program_memory_ptr,
    program_memory_length,
    exec_result.byteOffset,
  );

  if (result < 0) {
    return Error(`${result}`);
  }
  return exec_result.getBigUint64(0, true);
}

export function malloc(wasm: WebAssembly.Instance, size: number): number {
  const malloc_fn = wasm.exports.malloc as (a: number) => number;
  return malloc_fn(size);
}

export function generate_ubpf_dispatch_system(): [
  RegisterFunctionType,
  DispatchFunctionType,
] {
  const dispatch_table: Map<number, UbpfPlatformSpecificHelperFunctionType> =
    new Map<number, UbpfPlatformSpecificHelperFunctionType>();

  const register_function = function (
    wasm: WebAssembly.Instance,
    vm: Vm,
    id: number,
    func: UbpfPlatformSpecificHelperFunctionType,
  ) {
    const ubpf_register_fn = wasm.exports.ubpf_register as (
      vm_ptr: number,
      idx: number,
    ) => number;
    const _result = ubpf_register_fn(vm.native_runtime, id);
    if (_result != 0) {
      console.error("Error: Could not register function ");
      return;
    }
    dispatch_table.set(id, func);
  };

  const dispatch_function = function (
    idx: number,
    a0: bigint,
    a1: bigint,
    a2: bigint,
    a3: bigint,
    a4: bigint,
  ): bigint {
    if (dispatch_table.has(idx)) {
      const f = dispatch_table.get(idx)!;
      return BigInt(f(a0, a1, a2, a3, a4));
    }
    console.error(
      `Error: Could not find a function to dispatch to with id ${idx}.`,
    );
    return BigInt(-1);
  };

  return [register_function, dispatch_function];
}

export function set_unwind_index(
  wasm: WebAssembly.Instance,
  vm: Vm,
  unwind_index: number,
): number | Error {
  const unwind_function = wasm.exports.ubpf_set_unwind_function_index as (
    vm_ptr: number,
    unwind_index: number,
  ) => number;
  const result = unwind_function(vm.native_runtime, unwind_index);
  if (result == 0) {
    return 0;
  }
  return new Error("Failed to register the unwind index");
}