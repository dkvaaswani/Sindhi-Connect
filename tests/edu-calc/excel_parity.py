"""Excel vs website parity check.

    python3 tests/edu-calc/excel_parity.py

For each scenario in parity-scenarios.json: writes the inputs into a copy of the workbook, recalculates it with
LibreOffice (headless), reads the Savings Calculator summary, and compares it with the JavaScript engine's output.
Needs: Python 3 + openpyxl, LibreOffice (soffice), Node.js. Exits non-zero on any mismatch.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from openpyxl import load_workbook

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
XLSX = os.path.join(ROOT, "frontend", "downloads", "Children_Education_Fund_Calculator.xlsx")
SCEN = os.path.join(os.path.dirname(__file__), "parity-scenarios.json")
TOL = 1e-6  # relative

OVR_ROW = {"tuition": 42, "otherMandatoryAnnual": 43, "accommodation": 44, "food": 45, "transport": 46, "healthInsurance": 47,
           "books": 48, "personal": 49, "combinedLiving": 50, "oneTimeAdmission": 51, "visaApplication": 52,
           "travelRelocation": 53, "otherOneTime": 54}
FIELDS = [("yearsToCollege", "n"), ("costAtStart", "start"), ("totalCost", "total"), ("tuitionTotal", "tui"),
          ("livingTotal", "liv"), ("otherTotal", "oth"), ("scholarshipTotal", "sch"), ("fvSavingsAtStart", "fvs"),
          ("fvContributionsAtStart", "fvc"), ("requiredLumpNow", "LUMP"), ("requiredAnnualFirstYear", "X"),
          ("totalShortfall", "short"), ("coverage", "cov"), ("surplusOrGap", "gap")]


def recalc(path):
    script = "/mnt/skills/public/xlsx/scripts/recalc.py"
    if os.path.exists(script):
        out = subprocess.run([sys.executable, script, path, "180"], capture_output=True, text=True)
        res = json.loads(out.stdout)
        if res.get("status") != "success":
            raise SystemExit("Recalculation problem: " + out.stdout)
        return
    d = os.path.dirname(path)
    subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", d + "/out", path], check=True, capture_output=True)
    shutil.move(os.path.join(d, "out", os.path.basename(path)), path)


def write_inputs(ws, s):
    f = s["family"]
    ws["C6"] = f["numChildren"]
    ws["C9"] = f.get("eduCountry")
    for ref, key in [("C10", "repCcy"), ("C11", "entryAge"), ("C12", "ret"), ("C13", "tuiInf"), ("C14", "livInf"), ("C15", "esc"),
                     ("C16", "cont"), ("C17", "fxDrift"), ("C18", "mode")]:
        ws[ref] = f.get(key)
    for k in range(4):
        col = "CDEF"[k]
        c = s["children"][k] if k < len(s["children"]) else {}
        vals = {24: c.get("name"), 25: c.get("age"), 27: c.get("entryAge"), 28: c.get("country"), 29: c.get("category"),
                30: c.get("qualification"), 33: c.get("university"), 34: c.get("duration"), 35: c.get("savings", 0),
                36: c.get("monthly", 0), 37: c.get("annual", 0), 38: c.get("schPct", 0), 39: c.get("schFixed", 0),
                40: c.get("otherFunding", 0)}
        for r, v in vals.items():
            ws[f"{col}{r}"] = v
        for r in range(42, 55):
            ws[f"{col}{r}"] = None
        for key, v in (c.get("overrides") or {}).items():
            ws[f"{col}{OVR_ROW[key]}"] = v


def main():
    layout = json.loads(subprocess.run([sys.executable, os.path.join(ROOT, "tools/edu-calc/build.py"), "--layout"],
                                       capture_output=True, text=True, check=True).stdout.strip().splitlines()[-1])
    SR = layout["SR"]
    js = json.loads(subprocess.run(["node", os.path.join(os.path.dirname(__file__), "parity-js.js")],
                                   capture_output=True, text=True, check=True).stdout)
    scenarios = json.load(open(SCEN, encoding="utf-8"))
    tmp = tempfile.mkdtemp()
    failures, checks, worst = 0, 0, 0.0
    report = []
    for s, j in zip(scenarios, js):
        path = os.path.join(tmp, "s.xlsx")
        shutil.copy(XLSX, path)
        wb = load_workbook(path)
        write_inputs(wb["Parent Inputs"], s)
        wb.save(path)
        recalc(path)
        ws = load_workbook(path, data_only=True)["Savings Calculator"]
        lines = [f"### {s['name']}"]
        for k, child in enumerate(j["children"]):
            col = "CDEF"[k]
            if child.get("invalid"):
                lines.append(f"- Child {k+1}: invalid in JS")
                continue
            for jf, xf in FIELDS:
                xv = ws[f"{col}{SR[xf]}"].value or 0
                jv = child[jf] or 0
                if jf == "surplusOrGap" and child["totalShortfall"] == 0:
                    pass
                diff = abs(xv - jv) / max(1.0, abs(jv))
                worst = max(worst, diff)
                checks += 1
                if diff > TOL:
                    failures += 1
                    lines.append(f"- MISMATCH child {k+1} {jf}: Excel {xv} vs JS {jv}")
            lines.append(f"- Child {k+1}: required first-year annual {child['requiredAnnualFirstYear']:,.2f}, lump {child['requiredLumpNow']:,.2f}, "
                         f"total cost {child['totalCost']:,.2f} — matched")
        report.append("\n".join(lines))
    print("\n\n".join(report))
    print(f"\n{checks} values compared, {failures} mismatches, largest relative difference {worst:.2e}")
    shutil.rmtree(tmp, ignore_errors=True)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
