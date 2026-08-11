"""
Helper para generar el archivo .xls de la gestoría.

Pipeline:
  1) Recibe por argv:
     - path de la plantilla .xls (o .xls cifrado, si se le pasa la
       contraseña por env)
     - path de salida
     - path a un JSON con los datos (mapping + filas + celdas)
  2) Si la plantilla está cifrada y GESTORIA_TEMPLATE_PASSWORD está
     definida, descifra con msoffcrypto-tool en un temporal
  3) Carga la plantilla con xlrd, usa xlutils.copy para preservarla
  4) Escribe los valores en las celdas (xlwt)
  5) Guarda el .xls final

Por qué NO se hace todo en Node.js:
  - exceljs solo maneja .xlsx (OOXML)
  - SheetJS Community solo lee .xls (no escribe)
  - xlrd/xlwt son las herramientas nativas para .xls BIFF8
  - Llamar a Python como subprocess es la vía más simple y fiable

Por qué xlutils.copy en vez de xlwt from-scratch:
  - Preserva TODOS los formatos, fórmulas, estilos, anchuras, etc.
  - Si generamos desde cero perderíamos la plantilla de la gestoría
    (que es justamente lo que el usuario quiere mantener).

Si la plantilla está vacía/no tiene las celdas esperadas, el script
NO falla: marca las celdas ausentes en el JSON de salida para que
el controller pueda reportarlo al usuario en el preview.
"""
import argparse
import io
import json
import logging
import os
import shutil
import sys
import tempfile
import traceback
from pathlib import Path

logging.basicConfig(
    level=os.environ.get("GESTORIA_LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("gestoria_export")


def decrypt_template(encrypted_path: Path, password: str) -> Path:
    """
    Descifra el .xls con msoffcrypto-tool. Devuelve un path a un
    archivo temporal con la versión en claro.
    """
    import msoffcrypto  # type: ignore

    tmp = tempfile.NamedTemporaryFile(
        prefix="gestoria_template_", suffix=".xls", delete=False
    )
    tmp.close()
    with open(encrypted_path, "rb") as f:
        of = msoffcrypto.OfficeFile(f)
        of.load_key(password=password)
        with open(tmp.name, "wb") as out:
            of.decrypt(out)
    log.info("Plantilla descifrada en %s", tmp.name)
    return Path(tmp.name)


def load_data(data_path: Path) -> dict:
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _to_cell_value(raw, ctype: str):
    """
    Convierte un valor JSON al tipo que xlwt acepta.
    - ctype 'n' (numeric)  → float o int
    - ctype 's' (text)     → str
    - ctype 'b' (boolean)  → 1/0
    """
    if raw is None:
        return None
    if ctype == "b":
        if isinstance(raw, bool):
            return 1 if raw else 0
        if raw in (1, "1", "true", "True"):
            return 1
        return 0
    if ctype == "n":
        if isinstance(raw, (int, float)):
            return raw
        if isinstance(raw, str):
            s = raw.strip().replace(",", ".")
            if not s:
                return None
            try:
                if "." in s:
                    return float(s)
                return int(s)
            except ValueError:
                return None
        return None
    # text
    if isinstance(raw, str):
        return raw[:2000]
    return str(raw)[:2000]


def write_xls(template_path: Path, data: dict, output_path: Path) -> dict:
    """
    Escribe los datos sobre la plantilla (que se preserva).

    data = {
        "rows": [
            {
                "rowNumber": 5,            # opcional: si se da, escribe
                                            # valores en columnas fijas.
                                            # Si no, se usa el mapeo.
                "values": {"B": 10, "C": 5, "D": "EMPLEADO NOMBRE", ...}
            },
            ...
        ],
        "summary": {                      # totales opcionales
            "sheet": "Sheet1",
            "totals": {"G": 1234.56, ...}
        }
    }

    Devuelve un dict con metadatos: `writtenCells`, `missingCells`,
    `totalRows`, `outputSize`, `outputHash` (sha256).
    """
    import xlrd  # type: ignore
    from xlutils.copy import copy as xl_copy  # type: ignore
    import xlwt  # type: ignore
    import hashlib

    book = xlrd.open_workbook(str(template_path), formatting_info=True)
    # xlutils.copy preserva el libro entero (formatos, fórmulas, …)
    writable = xl_copy(book)

    # `counter` es una lista para que el closure del helper
    # `_write_cell` pueda mutar el contador sin `nonlocal` (más
    # portable entre versiones de Python).
    counter = [0]
    missing = []

    # Mapear sheets por nombre. xlwt no expone `sheet_names()`
    # directamente; usamos `_Workbook__sheets` con name-mangling.
    # Acceso seguro via getattr para no romper en versiones nuevas.
    name_to_index = {}
    try:
        sheets_attr = "_Workbook__sheets"  # atributo con name-mangling
        sheets = getattr(writable, sheets_attr, None)
        if sheets is not None:
            for i, sh in enumerate(sheets):
                # El nombre se guarda en `name` o via stream name
                nm = getattr(sh, "name", None) or f"Sheet{i+1}"
                name_to_index[nm] = i
    except Exception as e:
        log.warning("No se pudo enumerar hojas: %s", e)

    if not name_to_index:
        # Fallback: usar el orden de xlrd
        for i, name in enumerate(book.sheet_names()):
            name_to_index[name] = i

    sheet_names = list(name_to_index.keys())

    def _write_cell(ws, addr, raw):
        """Helper: escribe una celda con la dirección `addr`."""
        import re
        m = re.match(r"^([A-Z]+)(\d+)$", addr.strip().upper())
        if not m:
            missing.append({"reason": "invalid_address", "address": addr})
            return
        col_letters, row_str = m.group(1), m.group(2)
        col_idx = 0
        for ch in col_letters:
            col_idx = col_idx * 26 + (ord(ch) - ord("A") + 1)
        col_idx -= 1
        row_idx = int(row_str) - 1
        if isinstance(raw, bool):
            val = _to_cell_value(raw, "b")
            ws.write(row_idx, col_idx, val, xlwt.easyxf(""))
        elif isinstance(raw, (int, float)):
            ws.write(row_idx, col_idx, raw)
        elif isinstance(raw, str):
            s = raw.strip()
            try:
                if "." in s:
                    n = float(s.replace(",", "."))
                    ws.write(row_idx, col_idx, n)
                else:
                    n = int(s)
                    ws.write(row_idx, col_idx, n)
            except (ValueError, TypeError):
                ws.write(row_idx, col_idx, s)
        else:
            ws.write(row_idx, col_idx, str(raw))
        counter[0] += 1

    for row in data.get("rows", []):
        target_sheet = row.get("sheet", sheet_names[0] if sheet_names else None)
        if target_sheet not in name_to_index:
            log.warning("Hoja no encontrada: %s", target_sheet)
            missing.append({"reason": "sheet_not_found", "sheet": target_sheet})
            continue
        ws = writable.get_sheet(name_to_index[target_sheet])
        for addr, raw in (row.get("values") or {}).items():
            _write_cell(ws, addr, raw)

    # Resumen / totales
    summary = data.get("summary") or {}
    if summary:
        target_sheet = summary.get("sheet", sheet_names[0] if sheet_names else None)
        if target_sheet in name_to_index:
            ws = writable.get_sheet(name_to_index[target_sheet])
            for addr, raw in (summary.get("totals") or {}).items():
                _write_cell(ws, addr, raw)

    # Guardar
    output_path.parent.mkdir(parents=True, exist_ok=True)
    writable.save(str(output_path))

    # Hash
    sha = hashlib.sha256()
    with open(output_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha.update(chunk)
    file_size = output_path.stat().st_size
    return {
        "writtenCells": counter[0],
        "missingCells": missing,
        "outputSize": file_size,
        "outputHash": sha.hexdigest(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera .xls de gestoría")
    parser.add_argument("--template", required=True, help="Path a la plantilla .xls (cifrada o no)")
    parser.add_argument("--data", required=True, help="Path a JSON con los datos")
    parser.add_argument("--output", required=True, help="Path donde escribir el .xls final")
    parser.add_argument(
        "--password-env",
        default="GESTORIA_TEMPLATE_PASSWORD",
        help="Nombre de la variable de entorno con la contraseña (opcional)",
    )
    args = parser.parse_args()

    template_path = Path(args.template)
    if not template_path.exists():
        print(json.dumps({"ok": False, "error": f"Plantilla no encontrada: {template_path}"}), file=sys.stderr)
        return 2

    data = load_data(Path(args.data))

    # Determinar si la plantilla está cifrada
    is_encrypted = False
    try:
        with open(template_path, "rb") as f:
            head = f.read(8)
            # El Compound File Binary empieza con D0 CF 11 E0
            # Si los primeros 4 bytes no son D0 CF 11 E0, podría ser
            # un stream cifrado (ODP - "Encrypted Package").
            is_encrypted = head[:4] != b"\xd0\xcf\x11\xe0"
    except Exception:
        pass

    work_template = template_path
    try:
        if is_encrypted:
            password = os.environ.get(args.password_env) or ""
            if not password:
                print(
                    json.dumps(
                        {
                            "ok": False,
                            "error": f"Plantilla cifrada y {args.password_env} no definida",
                        }
                    ),
                    file=sys.stderr,
                )
                return 3
            work_template = decrypt_template(template_path, password)

        out_path = Path(args.output)
        meta = write_xls(work_template, data, out_path)
        # Output JSON al stdout
        result = {"ok": True, **meta, "template": str(template_path), "output": str(out_path)}
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as e:
        log.error("Error generando .xls: %s", e)
        log.error(traceback.format_exc())
        print(json.dumps({"ok": False, "error": str(e), "trace": traceback.format_exc()}), file=sys.stderr)
        return 1
    finally:
        if work_template != template_path and work_template.exists():
            try:
                work_template.unlink()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
