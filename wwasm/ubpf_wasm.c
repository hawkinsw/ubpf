#include <stdio.h>
#include <emscripten/emscripten.h>

EMSCRIPTEN_KEEPALIVE char
load(char* buffer)
{
    return buffer[0];
}