#!/bin/sh
# Restart contract: bring the preview server back on 0.0.0.0:8080 if it is down.
cd /workspace
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev
