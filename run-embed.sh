#!/bin/sh
#

deno  --allow-env \
  --allow-net \
  --env-file \
  deno/functions/generate-embeddings.ts 
