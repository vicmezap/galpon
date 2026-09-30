#!/bin/sh
# Apunta git a los hooks versionados del repositorio.
# Los hooks de .git/hooks NO se versionan; core.hooksPath si permite
# tenerlos dentro del proyecto y que viajen con el clon.
#
#     sh scripts/instalar_hooks.sh
git config core.hooksPath githooks
chmod +x githooks/* 2>/dev/null
echo "hooks instalados: $(git config core.hooksPath)"
