#include <stdio.h>
#include <emscripten/emscripten.h>
#include "ubpf.h"

int __executable() { ubpf_register(NULL, 0);}