/**
 * Load the WASM runtime.
 *
 * @returns {Promise<WebAssembly.WebAssemblyInstantiatedSource>} A promise to the
 * result of instantiating the wasm runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function load_runtime(importObject: any) {
    return WebAssembly.instantiateStreaming(
        fetch("build/ubpf.wasm"),
        importObject,
    );
}

class Vm {
    opaque: any;
}

/**
 * Load a BPF program into UBPF.
 *
 * @param wasm {WebAssembly.Instance} The instance of the wasm runtime
 * @returns {Vm} A VM instance that can be used for future ubpf calls.
 */
function create_runtime(wasm: WebAssembly.Instance): Vm {
    const ubpf_create = wasm.exports.ubpf_create as () => any;
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
function load_ubpf(
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

function exec_ubpf(
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

function malloc(wasm: WebAssembly.Instance, size: number): number {
    const malloc_fn = wasm.exports.malloc as (a: number) => number;
    return malloc_fn(size);
}
