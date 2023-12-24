function strlen(memory: DataView, start: number): number {
  let result = 0;
  while (memory.getUint8(start + result) != 0) {
    result++;
  }
  return result;
}

export function string_from_ptr(memory: DataView, offset: number): string {
      const error_str_len = strlen(memory, offset);
      const td = new TextDecoder();
      const string_memory = new DataView(memory.buffer, offset, error_str_len)
      return td.decode(string_memory)
}

export function malloc(wasm: WebAssembly.Instance, size: number): number {
  const malloc_fn = wasm.exports.malloc as (a: number) => number;
  return malloc_fn(size);
}

