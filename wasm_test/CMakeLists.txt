# Copyright (c) Microsoft Corporation
# SPDX-License-Identifier: Apache-2.0

add_custom_command(OUTPUT ${CMAKE_BINARY_DIR}/bin/run-interpret.sh 
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_SOURCE_DIR}/wasm_test/run-interpret.sh ${CMAKE_BINARY_DIR}/bin/run-interpret.sh 
    DEPENDS ${CMAKE_SOURCE_DIR}/wasm_test/run-interpret.sh
    COMMENT "Building wasm interpret-mode wrapper ... ")
add_custom_command(OUTPUT ${CMAKE_BINARY_DIR}/bin/run-jit.sh 
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_SOURCE_DIR}/wasm_test/run-jit.sh ${CMAKE_BINARY_DIR}/bin/run-jit.sh
    DEPENDS ${CMAKE_SOURCE_DIR}/wasm_test/run-jit.sh
    COMMENT "Building wasm jit-mode wrapper ... ")
add_custom_target(wasm-run-wrappers ALL DEPENDS ${CMAKE_BINARY_DIR}/bin/run-jit.sh ${CMAKE_BINARY_DIR}/bin/run-interpret.sh)