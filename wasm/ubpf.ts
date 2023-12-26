import { ptr_from_dataview, string_from_ptr } from "./ubpf_utils.ts";
import {
  DispatchFunctionType,
  Pointer,
  RegisterFunctionType,
  UbpfPlatformSpecificHelperFunctionType,
} from "./ubpf_types.ts";
/**
 * WasmRuntime wraps the `WebAssembly.Instance`, the `WebAssembly.Memory` and a global memory allocation function.
 */
export class WasmRuntime {
  public instance: WebAssembly.Instance;
  public memory: WebAssembly.Memory;

  constructor(instance: WebAssembly.Instance, memory: WebAssembly.Memory) {
    this.instance = instance;
    this.memory = memory;
  }

  public malloc(size: number): DataView {
    const malloc_fn = this.instance.exports.malloc as (a: number) => number;
    const location = malloc_fn(size);
    return new DataView(this.memory.buffer, location, size);
  }
}

/**
 * Ubpf is the workhorse -- used for executing eBPF programs.
 */
export class Ubpf {
  private _wasm: WasmRuntime;
  private _vm: Pointer;
  private _memory_view: DataView;

  constructor(wasm: WasmRuntime) {
    const ubpf_create = wasm.instance.exports.ubpf_create as () => Pointer;
    this._wasm = wasm;
    const vm = ubpf_create();
    this._vm = vm;
    this._memory_view = new DataView(this._wasm.memory.buffer);
  }

  public LoadProgram(program: DataView): [boolean, string] {
    const error_str_ptr_ptr = this._wasm.malloc(8);
    const runtime_memory =
      (this._wasm.instance.exports.memory as WebAssembly.Memory).buffer;
    const runtime_memory_view = new DataView(runtime_memory);

    const ubpf_load = this._wasm.instance.exports.ubpf_load as (
      a: number,
      b: number,
      c: number,
      d: number,
    ) => number;

    const result = ubpf_load(
      this._vm,
      ptr_from_dataview(program),
      program.byteLength,
      ptr_from_dataview(error_str_ptr_ptr),
    );
    if (result != 0) {
      const error_str_ptr = error_str_ptr_ptr.getBigUint64(0, true);
      return [
        false,
        string_from_ptr(runtime_memory_view, Number(error_str_ptr)),
      ];
    }
    return [true, "no error"];
  }

  /**
   * Jit and execute the loaded program
   *
   * @param program_memory A DataView relative to the VM's runtime memory where the program to execute
   * is loaded.
   * @returns bigint | Error The 64-bit number in register 0 at the end of the BPF program's execution
   * if the program executed successfully; an instance of Error (with a description of the failure) in
   * cases when the BPF program's execution did not succeed.
   */
  public Jit(
    program_memory: DataView,
  ): bigint | Error {
    const compiler_error_ptr_view = this._wasm.malloc(8);

    //this._memory_view.setBigUint64(compiler_error_ptr_data, BigInt(0));
    compiler_error_ptr_view.setBigUint64(0, BigInt(0));

    const ubpf_compile = this._wasm.instance.exports.ubpf_compile as (
      vm_ptr: number,
      program_memory_ptr: number,
    ) => number;

    const fn = ubpf_compile(
      this._vm,
      ptr_from_dataview(compiler_error_ptr_view),
    );

    const compiler_error_ptr = compiler_error_ptr_view.getBigUint64(0, true);

    if (compiler_error_ptr != BigInt(0)) {
      return Error(
        `Error in JIT compilation: ${
          string_from_ptr(this._memory_view, Number(compiler_error_ptr))
        }`,
      );
    }

    const jitted_module = new WebAssembly.Module(
      new Uint8Array(this._wasm.memory.buffer, fn, 39),
    );
    const jitted_instantiation = new WebAssembly.Instance(jitted_module);
    const jitted_function = jitted_instantiation.exports["add"] as () => number;

    console.log(`fn: --------${jitted_function()}----`);

    return BigInt(jitted_function());
  }

  /**
   * Interpret the loaded program
   *
   * @param program_memory A DataView relative to the VM's runtime memory where the program to execute
   * is loaded.
   * @returns The 64-bit number in register 0 at the end of the BPF program's execution
   * if the program executed successfully; an instance of Error (with a description of the failure) in
   * cases when the BPF program's execution did not succeed.
   */
  public Execute(
    program_memory: DataView,
  ): bigint | Error {
    const exec_result_data_view = this._wasm.malloc(8);

    exec_result_data_view.setBigUint64(0, BigInt(0));

    const ubpf_exec = this._wasm.instance.exports.ubpf_exec as (
      vm_ptr: number,
      program_memory_ptr: number,
      program_memory_length: number,
      result_ptr: number,
    ) => number;

    const program_memory_ptr = program_memory.byteLength != 0
      ? ptr_from_dataview(program_memory)
      : 0;
    const program_memory_length = program_memory.byteLength != 0
      ? program_memory.byteLength
      : 0;

    const result = ubpf_exec(
      this._vm,
      program_memory_ptr,
      program_memory_length,
      ptr_from_dataview(exec_result_data_view),
    );

    if (result < 0) {
      return Error(`${result}`);
    }
    return exec_result_data_view.getBigUint64(0, true);
  }

  public SetUnwindIndex(
    unwind_index: number,
  ): number | Error {
    const unwind_function = this._wasm.instance.exports
      .ubpf_set_unwind_function_index as (
        vm_ptr: number,
        unwind_index: number,
      ) => number;
    const result = unwind_function(this._vm, unwind_index);
    if (result == 0) {
      return 0;
    }
    return new Error("Failed to register the unwind index");
  }

  public GetRuntime(): number {
    return this._vm;
  }
}

export function generate_ubpf_dispatch_system(): [
  RegisterFunctionType,
  DispatchFunctionType,
] {
  const dispatch_table: Map<number, UbpfPlatformSpecificHelperFunctionType> =
    new Map<number, UbpfPlatformSpecificHelperFunctionType>();

  const register_function = function (
    wasm: WasmRuntime,
    ubpf: Ubpf,
    id: number,
    func: UbpfPlatformSpecificHelperFunctionType,
  ) {
    const ubpf_register_fn = wasm.instance.exports.ubpf_register as (
      vm: Pointer,
      idx: number,
    ) => number;
    const _result = ubpf_register_fn(ubpf.GetRuntime(), id);
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

/**
 * Load the WASM runtime.
 *
 * @returns A promise that resolves to either the error that occurred when loading the runtime or the loaded {@link WasmRuntime}.
 */
export async function load_runtime(
  importObject: WebAssembly.Imports,
): Promise<WasmRuntime | Error> {
  try {
    const wasmSourceFile = await Deno.open("./bin/ubpf_lib.wasm");
    const wasmSource = await Deno.readAll(wasmSourceFile);
    return WebAssembly.instantiate(wasmSource, importObject)
      .then(
        (result) => {
          return new WasmRuntime(
            result.instance,
            result.instance.exports.memory as WebAssembly.Memory,
          );
        },
        (reason) => {
          return new Error(reason);
        },
      );
  } catch (_error) {
    return new Error("Could not find the wasm binary.");
  }
}
