#!/usr/bin/env python3
"""Assemble report/final_report.md from the section files in report/final/.

Run from the repository root or from report/:   python report/build_final_report.py

The report follows the course template: a 150-word abstract, sections 1 to 9 (at most 8 pages), then references and
appendices. Section files, in order:
  final/00_abstract.md, final/01_introduction.md ... final/09_related_limitations_conclusion.md,
  final/99_references.md, final/A_appendix.md
The longer per-objective write-ups (report/objective*_*.md, wp12/README.md) are supporting material and are not
included. This script only reads the section files and checks them; it overwrites final_report.md only.
Then run report/build_docx.py to make the Word and PDF versions.
"""
import glob, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TITLE = "Do Learned Indexes Still Win on Modern Hardware?"
AUTHORS = "CIS 4930 Final Project, Team 01: Riyon Praveen, Vishakha Tiwari, Sevara Badriddinova, Tuan Khang Phan"


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read().strip() + "\n"


def main():
    files = sorted(glob.glob(os.path.join(HERE, "final", "*.md")))
    names = [os.path.basename(f) for f in files]
    expected = ["00_abstract.md"] + ["%02d_" % i for i in range(1, 10)] + ["99_references.md", "A_appendix.md"]
    for e in expected:
        assert any(n.startswith(e) for n in names), "missing section file: final/" + e
    parts = ["# " + TITLE + "\n", "*" + AUTHORS + "*\n"] + [read(f) for f in files]
    text = "\n".join(parts)
    problems = re.findall(r"\{\{[A-Z_0-9]+\}\}|\[TODO[^\]]*\]|\[PLACEHOLDER[^\]]*\]", text)
    if "–" in text or "—" in text:
        problems.append("en or em dash")
    abstract = re.sub(r"^#.*$|\*\*|\*", "", read(os.path.join(HERE, "final", "00_abstract.md")), flags=re.M)
    words = len(abstract.split())
    out = os.path.join(HERE, "final_report.md")
    with open(out, "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote %s (%d section files, abstract %d words)" % (out, len(files), words))
    if words > 150:
        problems.append("abstract has %d words (limit 150)" % words)
    if problems:
        print("NOT FINAL:", sorted(set(problems)))
        sys.exit(1)


if __name__ == "__main__":
    main()
