#include <emscripten/emscripten.h>
#include "ubpf.h"

int __executable() {
    // Make sure to keep these here -- they make sure that emscripten does not
    // aggressively remove these from the final binary.
    unsigned long long (*compile_result)(void*, unsigned long) = ubpf_compile(NULL, NULL);
    ubpf_exec(NULL, NULL, 0, NULL);
    ubpf_register(NULL, 0);
    ubpf_load(NULL, NULL, 0, NULL);
    return 0;
}