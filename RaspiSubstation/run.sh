#!/bin/bash

echo "Running"

# Kill background jobs on Ctrl+C
trap 'echo "Stopping..."; kill 0' SIGINT

python3 index.py & 
node index.js & 
wait
echo "Exited"
