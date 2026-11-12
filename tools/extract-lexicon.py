#!/usr/bin/env python3
"""Extract French-to-Eton candidates from the PDF's French-Eton index.

PDF page text is read without Unicode normalization. Every output entry remains
"a_verifier"; this script never marks linguistic content as validated.
"""

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

import pdfplumber
from pdfplumber.utils import extract_text


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = ROOT / "data" / "dochack" / "dictionnaire_eton-francais.pdf"
DEFAULT_OUTPUT = ROOT / "data" / "lexicon.json"
DEFAULT_REPORT = ROOT / "docs" / "LEXICON_QUALITY.md"
INDEX_START_PDF_PAGE = 286
INDEX_END_PDF_PAGE = 369
PRINTED_PAGE_OFFSET = 8


def clean_space(text):
    return re.sub(r"\s+", " ", text or "").strip()


def extract_chars(chars, x_tolerance=1.5):
    if not chars:
        return ""
    return clean_space(extract_text(chars, x_tolerance=x_tolerance, y_tolerance=3))


def clean_eton(text):
    text = clean_space(text)
    # In a few glyph overlaps, the PDF text layer orders a tone mark after its
    # following separator. Restore the visual order, retaining the same mark.
    text, repaired = re.subn(r"([^\W\d_])([\-;.,:])([\u0300-\u036f]+)", r"\1\3\2", text)
    text = re.sub(r"\s*-\s*", "-", text)
    text = re.sub(r"[.;,]+\s*$", "", text).strip()
    text = re.sub(r"(?<=\w)\((\d+)\)", r" (\1)", text)
    return text, repaired


def entry_key(entry):
    return (entry["fr"], entry["eton"], entry["pos"], entry["classe"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--start-page", type=int, default=INDEX_START_PDF_PAGE, help="PDF page, inclusive")
    parser.add_argument("--end-page", type=int, default=INDEX_END_PDF_PAGE, help="PDF page, inclusive")
    args = parser.parse_args()

    if not args.pdf.is_file():
        parser.error("PDF introuvable : " + str(args.pdf))

    candidates = []
    malformed_lines = []
    repaired_marks = 0
    pending_by_column = [dict(fr="", pos="", last=None), dict(fr="", pos="", last=None)]

    with pdfplumber.open(args.pdf) as pdf:
        if args.start_page < 1 or args.end_page > len(pdf.pages) or args.start_page > args.end_page:
            parser.error(f"Pages invalides pour ce PDF ({len(pdf.pages)} pages).")

        for pdf_page_number in range(args.start_page, args.end_page + 1):
            page = pdf.pages[pdf_page_number - 1]
            midpoint = page.width / 2
            printed_page_number = pdf_page_number - PRINTED_PAGE_OFFSET

            for line in page.extract_text_lines(return_chars=True):
                if not 48 < line["top"] < page.height - 45:
                    continue

                for column_index in (0, 1):
                    chars = [
                        char for char in line["chars"]
                        if (char["x0"] < midpoint if column_index == 0 else char["x0"] >= midpoint)
                    ]
                    if not chars:
                        continue

                    italic_chars = [char for char in chars if "Italic" in char["fontname"]]
                    eton_font_chars = [char for char in chars if "CharisSIL" in char["fontname"]]
                    pos_x = min((char["x0"] for char in italic_chars), default=None)
                    eton_start = min(
                        (char["x0"] for char in eton_font_chars if pos_x is None or char["x0"] > pos_x),
                        default=None,
                    )

                    fr_chars = []
                    if pos_x is not None:
                        fr_chars = [
                            char for char in chars
                            if char["x0"] < pos_x
                            and "Italic" not in char["fontname"]
                            and "CharisSIL" not in char["fontname"]
                        ]
                    elif eton_start is None:
                        fr_chars = [
                            char for char in chars
                            if "Italic" not in char["fontname"]
                            and "CharisSIL" not in char["fontname"]
                        ]

                    fr_text = extract_chars(fr_chars)
                    pos_text = extract_chars(italic_chars)
                    eton_text = extract_chars([char for char in chars if eton_start is not None and char["x0"] >= eton_start])
                    eton_text, repaired = clean_eton(eton_text)
                    repaired_marks += repaired
                    state = pending_by_column[column_index]

                    fr_text = re.sub(r"^(?:\(\d+\)\.\s*)+", "", fr_text)

                    if fr_text:
                        if pos_text or eton_text:
                            if state.get("pending_fr"):
                                fr_text = clean_space(state["pending_fr"] + " " + fr_text)
                            state["fr"] = fr_text
                            state["last"] = None
                            state.pop("pending_fr", None)
                        elif line["top"] > 105:
                            # Keep a possible wrapped French headword until its POS row.
                            state["pending_fr"] = clean_space(state.get("pending_fr", "") + " " + fr_text)
                            state["fr"] = ""
                            state["pos"] = ""
                            state["last"] = None

                    if pos_text:
                        if not state["fr"] and state.get("pending_fr"):
                            state["fr"] = state.pop("pending_fr")
                        if state["fr"]:
                            state["pos"] = pos_text

                    if not eton_text:
                        continue
                    if not state["fr"]:
                        if not pos_text and line["top"] < 110:
                            continue
                        malformed_lines.append(
                            f"PDF p. {pdf_page_number}, colonne {column_index + 1}: forme éton sans entrée française associée"
                        )
                        continue

                    if not pos_text and state.get("last") is not None:
                        state["last"]["eton"] = clean_space(state["last"]["eton"] + " " + eton_text)
                        continue

                    entry = {
                        "fr": state["fr"],
                        "eton": eton_text,
                        "pos": state.get("pos", ""),
                        "classe": "",
                        "source": (
                            "Dictionnaire éton-français, index français-éton, "
                            f"PDF p. {pdf_page_number} (pagination imprimée p. {printed_page_number})"
                        ),
                        "statut": "a_verifier",
                    }
                    candidates.append(entry)
                    state["last"] = entry

    deduplicated = []
    seen = set()
    for entry in candidates:
        key = entry_key(entry)
        if key in seen:
            continue
        seen.add(key)
        deduplicated.append(entry)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(deduplicated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    without_marks = sum(
        not any(unicodedata.category(char).startswith("M") for char in unicodedata.normalize("NFD", entry["eton"]))
        for entry in deduplicated
    )
    report_lines = [
        "# Rapport qualité du lexique extrait",
        "",
        f"- Source : `{args.pdf.name}`",
        f"- Pages PDF traitées : {args.start_page}–{args.end_page} (pagination imprimée : {args.start_page - PRINTED_PAGE_OFFSET}–{args.end_page - PRINTED_PAGE_OFFSET})",
        f"- Entrées écrites : {len(deduplicated)} (toutes `a_verifier`)",
        f"- Doublons exacts retirés : {len(candidates) - len(deduplicated)}",
        f"- Lignes mal parsées ou sans entrée française : {len(malformed_lines)}",
        f"- Formes éton sans diacritique Unicode détectable : {without_marks}",
        f"- Réordonnancements de marqueurs tonals dus au chevauchement des glyphes : {repaired_marks}",
        "",
        "Le décompte des diacritiques est un indicateur de revue, pas un verdict linguistique. La colonne `classe` reste vide lorsque l’index ne la fournit pas. Les tons extraits doivent être comparés au PDF avant toute validation.",
        "L’analyse fournie annonce plus de 6 200 renvois; le parseur a produit 5 697 entrées. Les unités de comptage peuvent différer, mais la couverture doit être contrôlée avant de considérer l’extraction exhaustive.",
    ]
    if malformed_lines:
        report_lines.extend(["", "## Premières lignes à examiner", ""])
        report_lines.extend("- " + issue for issue in malformed_lines[:25])
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text("\n".join(report_lines) + "\n", encoding="utf-8")

    print(f"Entrées écrites : {len(deduplicated)} (a_verifier)")
    print(f"Doublons retirés : {len(candidates) - len(deduplicated)}")
    print(f"Lignes mal parsées/non associées : {len(malformed_lines)}")
    print(f"Éton sans diacritique détectable : {without_marks}")
    print(f"Rapport : {args.report}")


if __name__ == "__main__":
    main()
