#!/usr/bin/env bash

# Define output index file name
OUTPUT_FILE="README.md"
n=0
# Start creating the markdown index
echo "# SVG Image Index" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
#echo "## Table of Contents" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 1. Generate the Table of Contents
#for svg in *.svg; do
#    # Skip if no .svg files are found
#    [ -e "$svg" ] || continue
#    
#    # Create an anchor link (remove spaces for the markdown anchor)
#    anchor=$(echo "$svg" | tr ' ' '-')
#    echo "- [$svg](#$anchor)" >> "$OUTPUT_FILE"
#done

# 2. Display each image
for svg in *.svg; do
    [ -e "$svg" ] || continue
    ((n++)) # Increments n by 1
    # Add a heading for the image and the image itself
    echo "$n. $svg" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "![$svg]($svg)" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
##    echo "<br>" >> "$OUTPUT_FILE"
##    echo "" >> "$OUTPUT_FILE"
done

echo "Markdown index generated successfully at $OUTPUT_FILE"
