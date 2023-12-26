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

set(ts_source_files "main.ts" "ubpf.ts" "ubpf_utils.ts" "ubpf_types.ts")
set(ts_outputs)
foreach(ts_file ${ts_source_files})
    add_custom_command(OUTPUT ${CMAKE_BINARY_DIR}/bin/${ts_file} COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_SOURCE_DIR}/wasm/${ts_file} ${CMAKE_BINARY_DIR}/bin/${ts_file} DEPENDS ${CMAKE_SOURCE_DIR}/wasm/${ts_file})
    list(APPEND ts_outputs ${CMAKE_BINARY_DIR}/bin/${ts_file})
endforeach()
add_custom_command(OUTPUT ${CMAKE_BINARY_DIR}/wasm_docs/ COMMAND npx typedoc --skipErrorChecking --out ${CMAKE_BINARY_DIR}/wasm_docs/ ${ts_source_files} WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/wasm DEPENDS ${ts_outputs})
add_custom_target(wasm-wrappers ALL DEPENDS ${ts_outputs} ${CMAKE_BINARY_DIR}/wasm_docs/)