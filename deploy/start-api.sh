#!/usr/bin/env bash
set -e
# systemd does not inherit the interactive shell's Node installation.
source /home/ubuntu/.nvm/nvm.sh
nvm use --silent 24
exec node node_modules/tsx/dist/cli.mjs src/server.ts
