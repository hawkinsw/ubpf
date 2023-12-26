import { Ubpf, WasmRuntime } from "./ubpf.ts";

/**
 * Generic pointer.
 */
export type Pointer = number;

/**
 * A nice name for the null pointer.
 */
export const NullPointer: Pointer = 0;

/**
 * The type of the platform-specific helper function.
 */
export type UbpfPlatformSpecificHelperFunctionType = (
  p1: bigint,
  p2: bigint,
  p3: bigint,
  p4: bigint,
  p5: bigint,
) => bigint;

/**
 * The type of the function that registers platform-specific helper functions.
 */
export type RegisterFunctionType = (
  a: WasmRuntime,
  b: Ubpf,
  c: number,
  d: UbpfPlatformSpecificHelperFunctionType,
) => void;

/**
 * The type of the function that dispatches to the platform-specific helper functions from the runtime.
 */
export type DispatchFunctionType = (
  tag: number,
  p1: bigint,
  p2: bigint,
  p3: bigint,
  p4: bigint,
  p5: bigint,
) => bigint;

