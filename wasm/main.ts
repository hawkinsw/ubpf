import {
    create_runtime,
    exec_ubpf,
    load_runtime,
    load_ubpf,
    malloc,
    generate_ubpf_dispatch_system
} from "./ubpf.ts";

import Context from "https://deno.land/std/wasi/snapshot_preview1.ts";

function testing_function() {
    console.log("I am in testing!")
}

async function main() {
    const context = new Context({
        args: Deno.args,
        env: Deno.env.toObject()
    });

    const [ubpf_register, ubpf_dispatcher] = generate_ubpf_dispatch_system();

    const importObject = {
        wasi_snapshot_preview1: context.exports,
        env: {
            ubpf_dispatcher: ubpf_dispatcher,
        }
    };

    const result = await load_runtime(importObject);
    if (result instanceof Error) {
        console.error(`There was an error loading the ubpf runtime: ${result}`);
        return;
    }
    const [runtime, memory] = result;
    const memory_buffer = memory.buffer;

    const program_bytes_loc = malloc(runtime, 40);
    const program_bytes = new Uint8Array(memory_buffer, program_bytes_loc, 40);

    const program_memory_loc = malloc(runtime, 512);
    const program_memory = new Uint8Array(
        memory_buffer,
        program_memory_loc,
        512,
    );

    program_bytes[0] = 0xb4;
    program_bytes[1] = 0x00;
    program_bytes[2] = 0x00;
    program_bytes[3] = 0x00;
    program_bytes[4] = 0x00;
    program_bytes[5] = 0x00;
    program_bytes[6] = 0x00;
    program_bytes[7] = 0x00;
    program_bytes[8] = 0xb4;
    program_bytes[9] = 0x01;
    program_bytes[10] = 0x00;
    program_bytes[11] = 0x00;
    program_bytes[12] = 0x02;
    program_bytes[13] = 0x00;
    program_bytes[14] = 0x00;
    program_bytes[15] = 0x00;
    program_bytes[16] = 0x04;
    program_bytes[17] = 0x00;
    program_bytes[18] = 0x00;
    program_bytes[19] = 0x00;
    program_bytes[20] = 0x01;
    program_bytes[21] = 0x00;
    program_bytes[22] = 0x00;
    program_bytes[23] = 0x00;
    program_bytes[24] = 0x0c;
    program_bytes[25] = 0x10;
    program_bytes[26] = 0x00;
    program_bytes[27] = 0x00;
    program_bytes[28] = 0x00;
    program_bytes[29] = 0x00;
    program_bytes[30] = 0x00;
    program_bytes[31] = 0x00;
    program_bytes[32] = 0x95;
    program_bytes[33] = 0x00;
    program_bytes[34] = 0x00;
    program_bytes[35] = 0x00;
    program_bytes[36] = 0x00;
    program_bytes[37] = 0x00;
    program_bytes[38] = 0x00;
    program_bytes[39] = 0x00;

    const vm = create_runtime(runtime);

    ubpf_register(runtime, vm, 7, testing_function);

    const load_result = load_ubpf(runtime, vm, program_bytes);
    console.log(`load_result: ${load_result}`);
    const exec_actual_result = exec_ubpf(
        runtime,
        vm,
        memory_buffer,
        program_memory.byteOffset,
        program_memory.length,
    );
    if (exec_actual_result instanceof Error) {
        console.log(`ubpf_exec failed: ${exec_actual_result}`);
    } else {
        console.log(`program's result: ${exec_actual_result}`);
    }
}

await main();
