# Copyright (c) Microsoft Corporation
# SPDX-License-Identifier: Apache-2.0

cmake_minimum_required(VERSION 3.25)

project(ubpf_wasm DESCRIPTION "ubpf wasm runtime")

set(EXPORT_COMPILE_COMMANDS FALSE)
if(NOT PLATFORM_WASM)
message(FATAL_ERROR "Must be built for emscripten.")
endif()

add_executable(
    ubpf_lib
    ubpf_lib.cc
)

target_link_libraries(
    ubpf_lib
    ubpf
    ubpf_settings
)
target_link_options("ubpf_lib" PRIVATE "SHELL:-s STANDALONE_WASM=1"  "SHELL:-s EXPORTED_FUNCTIONS='[_malloc]'" "SHELL:-s RESERVED_FUNCTION_POINTERS=1" -Wl,--no-entry)

add_custom_command(OUTPUT ${CMAKE_BINARY_DIR}/bin/main.ts COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_SOURCE_DIR}/wasm/main.ts ${CMAKE_BINARY_DIR}/bin/main.ts DEPENDS ${CMAKE_SOURCE_DIR}/wasm/main.ts)
add_custom_command(OUTPUT ${CMAKE_BINARY_DIR}/bin/ubpf.ts COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_SOURCE_DIR}/wasm/ubpf.ts ${CMAKE_BINARY_DIR}/bin/ubpf.ts DEPENDS ${CMAKE_SOURCE_DIR}/wasm/ubpf.ts)
add_custom_command(OUTPUT ${CMAKE_BINARY_DIR}/bin/ubpf_utils.ts COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_SOURCE_DIR}/wasm/ubpf_utils.ts ${CMAKE_BINARY_DIR}/bin/ubpf_utils.ts DEPENDS ${CMAKE_SOURCE_DIR}/wasm/ubpf_utils.ts)
add_custom_target(wasm-wrappers ALL DEPENDS ${CMAKE_BINARY_DIR}/bin/main.ts ${CMAKE_BINARY_DIR}/bin/ubpf.ts ${CMAKE_BINARY_DIR}/bin/ubpf_utils.ts)