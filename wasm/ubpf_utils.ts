import { Pointer } from "./ubpf_types.ts"

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
  const string_memory = new DataView(memory.buffer, offset, error_str_len);
  return td.decode(string_memory);
}

export function set_dataview_bytes(
  destination: DataView,
  source: Uint8Array,
): Error | null {
  if (destination.byteLength < source.byteLength) {
    return new Error("Destination buffer too small");
  }
  for (let i = 0; i < source.byteLength; i++) {
    destination.setUint8(i, source.at(i)!);
  }
  return null;
}


export function ptr_from_dataview(memory: DataView): Pointer {
  return memory.byteOffset
}