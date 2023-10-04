cmake_minimum_required(VERSION 3.25)

project(ubpf_wasm DESCRIPTION "ubpf wasm runtime")

set(EXPORT_COMPILE_COMMANDS FALSE)
if(NOT EMSCRIPTEN)
message(FATAL_ERROR "Must be built for emscripten.")
endif()

add_executable(ubpf_wasm ubpf_wasm.c)
