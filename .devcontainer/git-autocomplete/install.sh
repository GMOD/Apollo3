#!/usr/bin/env bash
UPDATE_RC="${UPDATE_RC:-"true"}"
AUTOCOMPLETE_SOURCE="source /usr/share/bash-completion/completions/git"

if [ "${UPDATE_RC}" = "true" ]; then
    echo "Updating /etc/bash.bashrc and /etc/zsh/zshrc..."
    if [[ "$(cat /etc/bash.bashrc)" != *"${AUTOCOMPLETE_SOURCE}"* ]]; then
        echo -e "${AUTOCOMPLETE_SOURCE}" >> /etc/bash.bashrc
    fi
    if [ -f "/etc/zsh/zshrc" ] && [[ "$(cat /etc/zsh/zshrc)" != *"${AUTOCOMPLETE_SOURCE}"* ]]; then
        echo -e "${AUTOCOMPLETE_SOURCE}" >> /etc/zsh/zshrc
    fi
fi
