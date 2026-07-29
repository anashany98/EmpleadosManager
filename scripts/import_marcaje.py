#!/usr/bin/env python3
"""
import_marcaje.py — Importa plantillas de marcaje Excel al módulo de gestoría.

Uso:
    python scripts/import_marcaje.py <archivo.xlsx> [--empresa EMPRESA] [--mes MES] [--anio ANIO]

Ejemplo:
    python scripts/import_marcaje.py "/path/to/2026 PLANTILLA MARCAJE EMPLEADO_24h.xlsx" --empresa "Decoraciones Egea" --mes 7 --anio 2026

El script:
1. Lee la estructura del Excel (columnas, configuración, festivos)
2. Extrae los datos de cada empleado (si el Excel está rellenado)
3. Genera un JSON con los conceptos y datos para importar al backend
"""

import argparse
import json
import sys
from datetime import datetime, time
from pathlib import Path

import pandas as pd


# =============================================================================
# Configuración de conceptos basada en la plantilla Excel
# =============================================================================

EXCEL_TO_CONCEPT = {
    'ENTRADA': {'code': 'H_ENTRADA_MA', 'label': 'Entrada Mañana', 'type': 'TEXT'},
    'SALIDA_1': {'code': 'H_SALIDA_MA', 'label': 'Salida Mañana', 'type': 'TEXT'},
    'ENTRADA_2': {'code': 'H_ENTRADA_TA', 'label': 'Entrada Tarde', 'type': 'TEXT'},
    'SALIDA': {'code': 'H_SALIDA_TA', 'label': 'Salida Tarde', 'type': 'TEXT'},
    'H.TRAB': {'code': 'H_TRABAJADAS', 'label': 'Horas Trabajadas', 'type': 'HOURS', 'is_system': True},
    'DESCONTAR': {'code': 'H_DESCANSO', 'label': 'Descanso (comida)', 'type': 'HOURS', 'is_system': True},
    'H.LAB': {'code': 'H_LABORABLES', 'label': 'Horas Laborables', 'type': 'HOURS', 'is_system': True},
    'H. EXT': {'code': 'H_EXTRAS', 'label': 'Horas Extra', 'type': 'HOURS'},
    'H EXT Festivos': {'code': 'H_EXTRAS_FEST', 'label': 'Horas Extra Festivos', 'type': 'HOURS'},
    'OBSERVACIONES': {'code': 'OBSERVACIONES', 'label': 'Observaciones', 'type': 'TEXT'},
}

# Conceptos adicionales del flujo de trabajo (no están en el Excel pero se usan)
EXTRA_CONCEPTS = [
    {'code': 'DIETAS', 'label': 'Dietas', 'type': 'AMOUNT', 'decimals': 2},
    {'code': 'PRODUCTIVIDAD', 'label': 'Productividad', 'type': 'AMOUNT', 'decimals': 2},
    {'code': 'KILOMETRAJE', 'label': 'Kilometraje', 'type': 'AMOUNT', 'decimals': 2},
    {'code': 'PLUS_OBRA', 'label': 'Plus de Obra', 'type': 'AMOUNT', 'decimals': 2},
    {'code': 'ANTICIPOS', 'label': 'Anticipos', 'type': 'AMOUNT', 'decimals': 2},
    {'code': 'DESCUENTOS', 'label': 'Descuentos', 'type': 'AMOUNT', 'decimals': 2},
]


def parse_time(val):
    """Convierte un valor de celda a string de hora (HH:MM)."""
    if pd.isna(val):
        return None
    if isinstance(val, time):
        return val.strftime('%H:%M')
    if isinstance(val, str):
        return val
    return str(val)


def parse_hours(val):
    """Convierte un valor a número de horas (float)."""
    if pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, time):
        return val.hour + val.minute / 60
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def detect_employee_columns(df):
    """
    Detecta las columnas del Excel basándose en el header (fila 4).
    Retorna un diccionario {nombre_columna: indice_columna}.
    """
    headers = {}
    for col in range(df.shape[1]):
        val = df.iloc[4, col] if df.shape[0] > 4 else None
        if pd.notna(val):
            header_name = str(val).strip()
            headers[header_name] = col
    return headers


def extract_config(df):
    """Extrae la configuración del Excel (descanso, horas laborables, límites)."""
    config = {
        'descanso_minutos': 30,
        'horas_laborables': 8.0,
        'limite_h_ext': 9,
        'limite_h_ext_festivos': 10,
    }

    # Fila 2: descanso y horas laborables
    if df.shape[0] > 2:
        descansar = df.iloc[2, 7] if df.shape[1] > 7 else None
        h_lab = df.iloc[2, 8] if df.shape[1] > 8 else None

        if pd.notna(descansar):
            if isinstance(descansar, time):
                config['descanso_minutos'] = descansar.hour * 60 + descansar.minute
            else:
                try:
                    config['descanso_minutos'] = float(descansar) * 60
                except (ValueError, TypeError):
                    pass

        if pd.notna(h_lab):
            if isinstance(h_lab, time):
                config['horas_laborables'] = h_lab.hour + h_lab.minute / 60
            else:
                try:
                    config['horas_laborables'] = float(h_lab)
                except (ValueError, TypeError):
                    pass

    # Fila 0: límites de horas extra
    if df.shape[0] > 0:
        h_ext = df.iloc[0, 13] if df.shape[1] > 13 else None
        h_ext_fest = df.iloc[0, 14] if df.shape[1] > 14 else None

        if pd.notna(h_ext):
            try:
                config['limite_h_ext'] = int(float(h_ext))
            except (ValueError, TypeError):
                pass
        if pd.notna(h_ext_fest):
            try:
                config['limite_h_ext_festivos'] = int(float(h_ext_fest))
            except (ValueError, TypeError):
                pass

    return config


def extract_month_data(df, headers, month_name):
    """
    Extrae los datos de un empleado para un mes específico.
    Retorna una lista de diccionarios con los valores por día.
    """
    rows = []
    data_start = 5  # Fila donde empiezan los datos (después del header)

    for row_idx in range(data_start, df.shape[0]):
        row = df.iloc[row_idx]
        day_data = {}

        # Día de la semana
        day_name = row.iloc[0] if pd.notna(row.iloc[0]) else None
        if day_name:
            day_data['dia'] = str(day_name)

        # Fecha
        fecha = row.iloc[1] if pd.notna(row.iloc[1]) else None
        if fecha:
            if isinstance(fecha, datetime):
                day_data['fecha'] = fecha.strftime('%Y-%m-%d')
            else:
                day_data['fecha'] = str(fecha)

        # Horarios de entrada/salida
        if 'ENTRADA' in headers:
            col_idx = headers['ENTRADA']
            if col_idx < df.shape[1]:
                val = row.iloc[col_idx]
                if pd.notna(val):
                    day_data['entrada_manana'] = parse_time(val)

        if 'SALIDA' in headers:
            # Primera ocurrencia de SALIDA = mañana
            col_idx = headers['SALIDA']
            if col_idx < df.shape[1]:
                val = row.iloc[col_idx]
                if pd.notna(val):
                    day_data['salida_manana'] = parse_time(val)

        # Segunda ENTRADA/SALIDA (tarde)
        # Buscar la segunda ocurrencia
        entrada_cols = [i for i, h in enumerate(df.iloc[4]) if pd.notna(h) and str(h).strip() == 'ENTRADA']
        salida_cols = [i for i, h in enumerate(df.iloc[4]) if pd.notna(h) and str(h).strip() == 'SALIDA']

        if len(entrada_cols) > 1:
            val = row.iloc[entrada_cols[1]]
            if pd.notna(val):
                day_data['entrada_tarde'] = parse_time(val)

        if len(salida_cols) > 1:
            val = row.iloc[salida_cols[1]]
            if pd.notna(val):
                day_data['salida_tarde'] = parse_time(val)

        # Horas calculadas
        for excel_col, concept in EXCEL_TO_CONCEPT.items():
            if excel_col in headers:
                col_idx = headers[excel_col]
                if col_idx < df.shape[1]:
                    val = row.iloc[col_idx]
                    if pd.notna(val):
                        if concept['type'] == 'HOURS':
                            day_data[concept['code']] = parse_hours(val)
                        elif concept['type'] == 'TEXT':
                            day_data[concept['code']] = str(val)

        # Solo agregar si tiene datos meaningful
        if len(day_data) > 2:  # Más allá de solo día y fecha
            rows.append(day_data)

    return rows


def extract_festivos(xls):
    """Extrae la lista de festivos del Excel."""
    try:
        df = pd.read_excel(xls, sheet_name='FESTIVOS', header=None)
        festivos = []
        for val in df.iloc[:, 0]:
            if pd.notna(val):
                if isinstance(val, datetime):
                    festivos.append(val.strftime('%Y-%m-%d'))
                else:
                    festivos.append(str(val))
        return festivos
    except Exception:
        return []


def process_excel(filepath, empresa=None, mes=None, anio=None):
    """
    Procesa un archivo Excel de marcaje y retorna un JSON estructurado
    para importar al módulo de gestoría.
    """
    xls = pd.ExcelFile(filepath, engine='xlrd' if filepath.endswith('.XLS') else None)

    # Determinar mes/año del archivo si no se especifican
    if not mes or not anio:
        # Intentar extraer del nombre del archivo o primera hoja
        first_sheet = xls.sheet_names[0]
        month_map = {
            'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4,
            'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8,
            'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
        }
        for name, num in month_map.items():
            if name in first_sheet.upper():
                mes = mes or num
                break

    # Por defecto, usar 2026 si no se especifica
    anio = anio or 2026
    mes = mes or 7  # Julio por defecto

    result = {
        'archivo_origen': filepath,
        'empresa': empresa or 'Sin especificar',
        'anio': anio,
        'mes': mes,
        'fecha_importacion': datetime.now().isoformat(),
        'configuracion': {},
        'festivos': [],
        'conceptos': [],
        'empleados': [],
    }

    # Procesar cada hoja mensual
    for sheet_name in xls.sheet_names:
        if sheet_name.upper() == 'FESTIVOS':
            result['festivos'] = extract_festivos(xls)
            continue

        # Mapear nombre de hoja a número de mes
        month_map = {
            'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4,
            'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8,
            'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
        }
        sheet_month = None
        for name, num in month_map.items():
            if name in sheet_name.upper():
                sheet_month = num
                break

        if sheet_month != mes:
            continue  # Solo procesar el mes solicitado

        df = pd.read_excel(xls, sheet_name=sheet_name, header=None)

        # Extraer configuración
        result['configuracion'] = extract_config(df)

        # Detectar columnas
        headers = detect_employee_columns(df)

        # Extraer datos
        month_data = extract_month_data(df, headers, sheet_name)

        # Crear entrada de empleado (la plantilla es para un solo empleado)
        empleado = {
            'nombre': empresa or 'Empleado',
            'mes': sheet_name,
            'datos_dia': month_data,
            'total_horas_trabajadas': sum(d.get('H_TRABAJADAS', 0) for d in month_data),
            'total_horas_extra': sum(d.get('H_EXTRAS', 0) for d in month_data),
            'total_horas_extra_festivos': sum(d.get('H_EXTRAS_FEST', 0) for d in month_data),
        }
        result['empleados'].append(empleado)

    # Generar lista de conceptos
    for excel_col, concept in EXCEL_TO_CONCEPT.items():
        result['conceptos'].append({
            'code': concept['code'],
            'label': concept['label'],
            'type': concept['type'],
            'is_system': concept.get('is_system', False),
        })

    # Agregar conceptos extra
    result['conceptos'].extend(EXTRA_CONCEPTS)

    return result


def main():
    parser = argparse.ArgumentParser(
        description='Importa plantillas de marcaje Excel al módulo de gestoría'
    )
    parser.add_argument('archivo', help='Ruta al archivo Excel de marcaje')
    parser.add_argument('--empresa', help='Nombre de la empresa')
    parser.add_argument('--mes', type=int, help='Mes a importar (1-12)')
    parser.add_argument('--anio', type=int, help='Año a importar')
    parser.add_argument('--output', help='Archivo JSON de salida (opcional)')

    args = parser.parse_args()

    if not Path(args.archivo).exists():
        print(f'Error: No se encontró el archivo {args.archivo}')
        sys.exit(1)

    try:
        result = process_excel(args.archivo, args.empresa, args.mes, args.anio)

        # Guardar JSON
        output_path = args.output or args.archivo.rsplit('.', 1)[0] + '_import.json'
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        print(f'Importación completada:')
        print(f'  - Empresa: {result["empresa"]}')
        print(f'  - Período: {result["mes"]}/{result["anio"]}')
        print(f'  - Conceptos: {len(result["conceptos"])}')
        print(f'  - Empleados: {len(result["empleados"])}')
        print(f'  - Festivos: {len(result["festivos"])}')
        print(f'  - Configuración: {result["configuracion"]}')
        print(f'  - JSON guardado en: {output_path}')

        # Mostrar resumen de datos
        for emp in result['empleados']:
            print(f'\n  Empleado: {emp["nombre"]}')
            print(f'    - Horas trabajadas: {emp["total_horas_trabajadas"]:.1f}h')
            print(f'    - Horas extra: {emp["total_horas_extra"]:.1f}h')
            print(f'    - Horas extra festivos: {emp["total_horas_extra_festivos"]:.1f}h')
            print(f'    - Días con datos: {len(emp["datos_dia"])}')

    except Exception as e:
        print(f'Error procesando el archivo: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
