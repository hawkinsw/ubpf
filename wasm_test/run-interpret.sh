#!/bin/bash
# Copyright (c) Microsoft Corporation
# SPDX-License-Identifier: Apache-2.0

# Work around for argument passing.
deno run --allow-read --allow-env bin/main.ts "$*"
