#!/bin/bash

echo "Running"

# Kill background jobs on Ctrl+C
trap 'echo "Stopping..."; kill 0' SIGINT

python3 index.py & 
/home/egg/.nvm/versions/node/v22.17.0/bin/node index.js & 
wait
echo "Exited"
