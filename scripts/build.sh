#!/usr/bin/env bash
# Rebuild public/pdfs/ and data/plans.json from the final CPMN book PDF.
# Each care plan is one page of the book; every page is copied out as its own PDF.
# Needs: python3 and PyMuPDF (pip install pymupdf).
# Usage: scripts/build.sh path/to/CPMN_book.pdf
#
# (parse.py + make_pdfs.py are the older generator that drew the pages from
#  source/CPMN_Book.txt; they are kept for reference only.)
set -e
if [ -z "$1" ]; then echo "Usage: scripts/build.sh path/to/CPMN_book.pdf"; exit 1; fi
cd "$(dirname "$0")/.."
python3 scripts/extract_from_book.py "$1"
