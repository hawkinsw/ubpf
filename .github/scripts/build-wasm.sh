#!/usr/bin/bash
# Copyright (c) Microsoft Corporation
# SPDX-License-Identifier: MIT

sudo mkdir /usr/emsdk
if [ $? -ne 0 ]; then
	echo "Could generate the emsdk installation directory."
	exit 1
fi

user=`id -n -u`
group=`id -n -g`

sudo chown /usr/emsdk ${user}:${group}

cd /usr/
if [ $? -ne 0 ]; then
	echo "Could not change directories to the emsdk installation directory."
	exit 1
fi

git clone https://github.com/emscripten-core/emsdk.git emsdk
if [ $? -ne 0 ]; then
	echo "Could not clone the emsdk repository."
	exit 1
fi

# Jump in to the src directory to do the actual build.
cd emsdk

git pull
if [ $? -ne 0 ]; then
	echo "Could not pull the actual EMSDK."
	exit 1
fi

./emsdk install latest
if [ $? -ne 0 ]; then
	echo "Could not install the latest EMSDK."
	exit 1
fi

./emsdk activate latest
if [ $? -ne 0 ]; then
	echo "Could not activate the latest EMSDK."
	exit 1
fi

exit 0
