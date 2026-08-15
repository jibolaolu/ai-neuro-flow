#!/usr/bin/env bash
# =============================================================================
# DEPRECATED — NeurAccess legacy startup script.
# This file was the old NeurAccess launcher. It pointed at neuroaccess.db,
# printed NeurAccess branding, and exposed WooCommerce webhook tunnel URLs.
#
# DO NOT USE THIS FILE.  Use the correct NeuroFlow launcher instead:
#
#   bash ./run_local.sh              # macOS / Linux / WSL
#   .\run-local.ps1                  # Windows PowerShell
#
# =============================================================================
set -euo pipefail

echo ""
echo "  ERROR: This script is deprecated (NeurAccess legacy launcher)."
echo ""
echo "  Use the correct NeuroFlow launcher:"
echo "    bash ./run_local.sh           (macOS / Linux / WSL)"
echo "    .\\run-local.ps1              (Windows PowerShell)"
echo ""
exit 1
