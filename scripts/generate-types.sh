#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Generate TypeScript types from the Supabase database schema.
# Run this after any migration to keep types in sync across all SOS apps.
#
# Prerequisites:
#   npm install -D supabase
#   npx supabase login
#
# Usage:
#   ./scripts/generate-types.sh
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_REF="jnbxkvlkqmwnqlmetknj"
OUTPUT_DIR="lib/types"

mkdir -p "$OUTPUT_DIR"

echo "Generating types for public schema..."
npx supabase gen types typescript \
  --project-id "$PROJECT_REF" \
  --schema public \
  > "$OUTPUT_DIR/database.public.ts"

echo "Generating types for research schema..."
npx supabase gen types typescript \
  --project-id "$PROJECT_REF" \
  --schema research \
  > "$OUTPUT_DIR/database.research.ts"

echo ""
echo "Types generated:"
echo "  $OUTPUT_DIR/database.public.ts   (operational tables)"
echo "  $OUTPUT_DIR/database.research.ts (research tables)"
echo ""
echo "These files can be copied to other SOS repos that share this database."
