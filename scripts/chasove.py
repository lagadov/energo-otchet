"""Сумира реалните часове по етап от docs/sesii.csv (колони: дата,начало,край,етап,какво)."""
import csv
import sys
from collections import OrderedDict
from datetime import datetime


def minuti(nachalo: str, krai: str) -> int:
    """Минути между две времена ЧЧ:ММ в един ден. Край преди начало е грешка."""
    t0 = datetime.strptime(nachalo, "%H:%M")
    t1 = datetime.strptime(krai, "%H:%M")
    if t1 < t0:
        raise ValueError(f"краят {krai} е преди началото {nachalo}")
    return int((t1 - t0).total_seconds() // 60)


def po_etapi(redove) -> "OrderedDict[str, float]":
    """Връща {етап: часове}, закръглени до 0.1, в реда на първо появяване."""
    sbor = OrderedDict()
    for red in redove:
        etap = red["етап"].strip()
        sbor[etap] = sbor.get(etap, 0) + minuti(red["начало"].strip(), red["край"].strip())
    return OrderedDict((e, round(m / 60, 1)) for e, m in sbor.items())


def main(pat: str) -> None:
    with open(pat, encoding="utf-8", newline="") as f:
        rezultat = po_etapi(csv.DictReader(f))
    for etap, chasa in rezultat.items():
        print(f"{etap}\t{chasa} ч")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "docs/sesii.csv")
