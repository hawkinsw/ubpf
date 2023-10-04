/**
 * Load a BPF program into UBPF.
 *
 * @param wasm {WebAssembly.Instance} The instance of the wasm runtime
 * @param {number} program Pointer to wasm memory of ebpf program to load
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function load_ubpf(wasm: WebAssembly.Instance, program: number) {
    const loader: (toload: number) => void = wasm.exports.load as (
        toload: number,
    ) => void;
    console.log(loader(program));
}

/**
 * Load the WASM runtime.
 *
 * @returns {Promise<WebAssembly.WebAssemblyInstantiatedSource>} A promise to the
 * result of instantiating the wasm runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function load_runtime() {
    return WebAssembly.instantiateStreaming(fetch("build/wwasm_lib.wasm"));
}
