#!/bin/bash

OUTPUT_FILE="artwork.json"
TARGET_DIR="artwork"

# Start the JSON array
echo "[" > "$OUTPUT_FILE"

first=true
n=1

find "$TARGET_DIR" -type f -name "*.svg" -print0 | while IFS= read -r -d '' filepath; do
 # Check if file exists (handles case where no svg files are found)
  [ -e "$filepath" ] || continue

  ((n++))
  filename=$(basename "$filepath")
  # Handle comma separation for JSON array
  if [ "$first" = true ]; then
    first=false
  else
    echo "," >> "$OUTPUT_FILE"
  fi

  # Write JSON object for the file
  echo "  {" >> "$OUTPUT_FILE"
  echo "   \"metadata\":{" >> "$OUTPUT_FILE"
  echo "    \"name\": \"$filename\"," >> "$OUTPUT_FILE"
  echo "    \"path\": \"$filepath\"" >> "$OUTPUT_FILE"
  echo "   }" >> "$OUTPUT_FILE"
  echo "  }" >> "$OUTPUT_FILE"
done

# End the JSON array
echo "]" >> "$OUTPUT_FILE"

echo "Done! Generated $OUTPUT_FILE"

#############################################################################
OUTPUT_FILE="artwork.md"
n=0
# Start creating the markdown index
echo "# SVG Image Index" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
#echo "## Table of Contents" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

find "$TARGET_DIR" -type f -name "*.svg" -print0 | while IFS= read -r -d '' filepath; do
 # Check if file exists (handles case where no svg files are found)
  [ -e "$filepath" ] || continue
  filename=$(basename "$filepath")
  ((n++)) # Increments n by 1
  # Add a heading for the image and the image itself
  echo "$n. $filename" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  echo "![$filename]($filepath)" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  echo "<br>" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
done

echo "Markdown index generated successfully at $OUTPUT_FILE"
