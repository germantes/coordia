from datetime import datetime

def calcular_confianza(creador, proximidad_m, confirmaciones):
    # 1. Reputación del Creador (30%)
    # Si es nuevo parte de 0.20
    rep_creador = creador.get("reputacion", 0.20)
    score_creador = 0.30 * rep_creador

    # 2. Proximidad Geográfica (25%)
    # Menos de 200m = 1.0, más de 1000m = 0.0
    if proximidad_m <= 200:
        factor_geo = 1.0
    elif proximidad_m >= 1000:
        factor_geo = 0.0
    else:
        factor_geo = max(0.0, 1.0 - (proximidad_m - 200) / 800)
    score_geo = 0.25 * factor_geo

    # 3. Validación Social Ponderada (35%)
    if confirmaciones:
        promedio_val = sum(c.get("reputacion", 0.20) for c in confirmaciones) / len(confirmaciones)
    else:
        promedio_val = 0.0
    score_social = 0.35 * promedio_val

    base_score = score_creador + score_geo + score_social

    # 4. Reglas de Penalización por Manipulación / Coordinación
    penalizacion = 0.0
    motivos_penalizacion = []

    # Regla: -0.40 ante 3 o más confirmaciones en menos de 30 segundos
    if len(confirmaciones) >= 3:
        timestamps = sorted([datetime.fromisoformat(c["timestamp"]) for c in confirmaciones if "timestamp" in c])
        if len(timestamps) >= 3:
            diferencia = (timestamps[-1] - timestamps[0]).total_seconds()
            if diferencia < 30:
                penalizacion += 0.40
                motivos_penalizacion.append("Ataque coordinado en tiempo (< 30s)")

    # Regla: -0.30 cuando las cuentas comparten IP, subred o dispositivo
    ips = [c.get("ip") for c in confirmaciones if "ip" in c]
    subredes = [c.get("subnet") for c in confirmaciones if "subnet" in c]
    devices = [c.get("device_id") for c in confirmaciones if "device_id" in c]

    if (len(ips) != len(set(ips))) or (len(subredes) != len(set(subredes))) or (len(devices) != len(set(devices))):
        penalizacion += 0.30
        motivos_penalizacion.append("Cuentas coordinadas compartiendo IP/subred/dispositivo")

    final_score = max(0.0, round(base_score - penalizacion, 2))

    # Umbrales de estado
    if final_score >= 0.70:
        estado = "VERIFIED"
    elif final_score >= 0.40:
        estado = "UNDER_REVIEW"
    else:
        estado = "REJECTED"

    return {
        "score_creador": round(score_creador, 2),
        "score_geo": round(score_geo, 2),
        "score_social": round(score_social, 2),
        "base_score": round(base_score, 2),
        "penalizacion": round(penalizacion, 2),
        "motivos": motivos_penalizacion,
        "final_score": final_score,
        "status": estado
    }

if __name__ == "__main__":
    print("=== CASO 1: REPORTE LEGÍTIMO ===")
    creador_legitimo = {"reputacion": 0.90} # 0.30 * 0.90 = 0.27
    proximidad_legitima = 100 # <= 200m -> 1.0 * 0.25 = 0.25
    confirmaciones_legitimas = [
        {"reputacion": 0.85, "ip": "192.168.1.10", "timestamp": "2026-11-11T10:00:00"},
        {"reputacion": 0.90, "ip": "192.168.2.11", "timestamp": "2026-11-11T10:05:00"},
        {"reputacion": 0.80, "ip": "192.168.3.12", "timestamp": "2026-11-11T10:15:00"}
    ] # promedio = 0.85 -> 0.35 * 0.85 = 0.2975 -> base: 0.27 + 0.25 + 0.30 = 0.82
    res_legitimo = calcular_confianza(creador_legitimo, proximidad_legitima, confirmaciones_legitimas)
    print(res_legitimo)

    print("\n=== CASO 2: ATAQUE SYBIL / COORDINADO ===")
    creador_sybil = {"reputacion": 0.20} # nuevo usuario
    proximidad_sybil = 150
    confirmaciones_sybil = [
        {"reputacion": 0.20, "ip": "10.0.0.1", "device_id": "dev-01", "timestamp": "2026-11-11T10:00:00"},
        {"reputacion": 0.20, "ip": "10.0.0.1", "device_id": "dev-01", "timestamp": "2026-11-11T10:00:05"},
        {"reputacion": 0.20, "ip": "10.0.0.1", "device_id": "dev-01", "timestamp": "2026-11-11T10:00:10"}
    ]
    res_sybil = calcular_confianza(creador_sybil, proximidad_sybil, confirmaciones_sybil)
    print(res_sybil)
