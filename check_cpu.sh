#!/bin/bash

# We run top twice (-n 2) because the first iteration 
# usually shows static averages since boot. 
# We grab the second iteration (tail -n 1) for current live data.

CPU_USAGE=$(top -bn2 | grep "Cpu(s)" | tail -n 1 | awk '{print $2 + $4}')

echo "Current CPU Utilization: $CPU_USAGE%"
