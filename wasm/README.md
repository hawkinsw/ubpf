## The UBPF Wasm Integration

### Building

#### Prerequisites:
1. deno
2. cmake
3. emscripten

#### Configuring Prequisites:

```console
$ npm install
```

#### Building

```console
$ CMAKE_TOOLCHAIN_FILE=<path to emsdk>/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake cmake -B build -S .
```

If you build and enable tests, be sure to disable external tests.

```console
$ CMAKE_TOOLCHAIN_FILE=<path to emsdk>/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake cmake -B build -S . -DUBPF_ENABLE_TESTS -DUBPF_SKIP_EXTERNAL
```
```console
$ npm run build
```
