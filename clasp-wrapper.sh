#!/bin/bash
# Temporarily swap credentials for project-specific clasp commands

BACKUP_FILE="$HOME/.clasprc.json.backup"
PROJECT_CREDS=".clasp-credentials.json"

# Backup global credentials if they exist
if [ -f "$HOME/.clasprc.json" ]; then
    cp "$HOME/.clasprc.json" "$BACKUP_FILE"
fi

# Copy project credentials to global location
cp "$PROJECT_CREDS" "$HOME/.clasprc.json"

# Run clasp command with all arguments (use full path to ensure correct version)
/opt/homebrew/bin/clasp "$@"
EXIT_CODE=$?

# Restore original credentials
if [ -f "$BACKUP_FILE" ]; then
    mv "$BACKUP_FILE" "$HOME/.clasprc.json"
else
    rm "$HOME/.clasprc.json"
fi

exit $EXIT_CODE
