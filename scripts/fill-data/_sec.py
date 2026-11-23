def sec(typ, label, en=None, es=None, notes=""):
    return {"type": typ, "label": label, "notes": notes, "linesEn": list(en or []), "linesEs": list(es or [])}
