#!/usr/bin/env bash

# Brandroom AI UGC Studio Desktop Launcher
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

PYTHON_BIN="$(which python3 2>/dev/null || echo "/usr/bin/python3")"

# Check if server is already responding on port 8765
if ! curl -s -m 1 http://127.0.0.1:8765/ > /dev/null 2>&1; then
    nohup "$PYTHON_BIN" "$DIR/server.py" > "$DIR/server.log" 2>&1 &
    
    # Wait for server to be responsive (up to 6 seconds)
    for i in {1..12}; do
        if curl -s -m 1 http://127.0.0.1:8765/ > /dev/null 2>&1; then
            break
        fi
        sleep 0.5
    done
fi

# Open web interface in user's default browser
open "http://localhost:8765"
