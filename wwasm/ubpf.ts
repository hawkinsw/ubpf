/**
 * Load the WASM runtime.
 *
 * @returns {Promise<[WebAssembly.Instance, WebAssembly.Memory], Error>} A promise to either the
 * error that occurred when loading the runtime or the pair of the instance of the wasm runtime
 * and its memory.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function load_runtime(
  importObject: WebAssembly.Imports,
): Promise<[WebAssembly.Instance, WebAssembly.Memory] | Error> {
  const wasmSourceFile = await Deno.open("./build/ubpf.wasm");
  const wasmSource = await Deno.readAll(wasmSourceFile);
  return WebAssembly.instantiate(wasmSource, importObject).then(
    (result) => {
      console.log(`${result.instance.exports.ccall}`);
      return [
        result.instance,
        result.instance.exports.memory as WebAssembly.Memory,
      ];
    },
    (reason) => {
      return new Error(reason);
    },
  );
}

export class Vm {
  opaque: Pointer = NullPointer;
}

export type Pointer = number;

export const NullPointer: Pointer = 0;

/**
 * Load a BPF program into UBPF.
 *
 * @param wasm {WebAssembly.Instance} The instance of the wasm runtime
 * @returns {Vm} A VM instance that can be used for future ubpf calls.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function create_runtime(wasm: WebAssembly.Instance): Vm {
  const ubpf_create = wasm.exports.ubpf_create as () => Pointer;
  const vm = ubpf_create();
  const runtime = new Vm();
  runtime.opaque = vm;
  return runtime;
}

/**
 * Load a BPF program into UBPF.
 *
 * @param wasm {WebAssembly.Instance} The instance of the wasm runtime
 * @param {number} program Pointer to wasm memory of ebpf program to load
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function load_ubpf(
  wasm: WebAssembly.Instance,
  vm: Vm,
  program: Uint8Array,
): [boolean, string] {
  const ubpf_load = wasm.exports.ubpf_load as (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => number;
  const result = ubpf_load(vm.opaque, program.byteOffset, program.length, 0);
  console.log(`result: ${result}`);
  return [true, "no error"];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function exec_ubpf(
  wasm: WebAssembly.Instance,
  vm: Vm,
  runtime_memory: ArrayBuffer,
  program_memory_ptr: number,
  program_memory_length: number,
): number | Error {
  const exec_result_loc = malloc(wasm, 8);
  const exec_result = new DataView(runtime_memory, exec_result_loc, 8);

  const ubpf_exec = wasm.exports.ubpf_exec as (
    vm_ptr: number,
    program_memory_ptr: number,
    program_memory_length: number,
    result_ptr: number,
  ) => number;
  const result = ubpf_exec(
    vm.opaque,
    program_memory_ptr,
    program_memory_length,
    exec_result_loc,
  );

  if (result < 0) {
    return Error(`$result`);
  }
  return Number(exec_result.getBigUint64(0, true));
}

export function malloc(wasm: WebAssembly.Instance, size: number): number {
  const malloc_fn = wasm.exports.malloc as (a: number) => number;
  return malloc_fn(size);
}

export type UbpfPlatformSpecificHelperFunctionType = () => void;
type RegisterFunctionType = (
  a: WebAssembly.Instance,
  b: Vm,
  c: number,
  d: UbpfPlatformSpecificHelperFunctionType,
) => void;
type DispatchFunctionType = (_: number) => void;

export function generate_ubpf_dispatch_system(): [
  RegisterFunctionType,
  DispatchFunctionType,
] {
  const dispatch_table: Map<number, () => void> = new Map<
    number,
    () => void
  >();

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
    const _result = ubpf_register_fn(vm.opaque, id);
    if (_result != 0) {
      console.error("Error: Could not register function ")
     return;
    }
    dispatch_table.set(id, func);
  };

  const dispatch_function = function (idx: number) {
    if (dispatch_table.has(idx)) {
      const f = dispatch_table.get(idx)!;
      f();
    } else {
      console.log(
        `Error: Could not find a function to dispatch to with id ${idx}.`,
      );
    }
  };

  return [register_function, dispatch_function];
}
