from datetime import datetime

# T1 prototype. T2 does not apply the -0.30 shared-origin penalty (IP/subnet/device):
# nearby honest confirmations share campus or ISP addresses. See
# docs/control/revisiones/2026-11-16-hu05-t2.md. The -0.40 burst rule stays.

def calcular_confianza(creador, proximidad_m, confirmaciones):
    # 0. Deduplicación por usuario
    confirmaciones_unicas = []
    vistos = set()
    for c in confirmaciones:
        uid = c.get("user_id")
        if uid is not None:
            if uid in vistos:
                continue
            vistos.add(uid)
        confirmaciones_unicas.append(c)

    # 1. Reputación del Creador (30%)
    rep_creador = creador.get("reputacion", 0.20)
    score_creador = 0.30 * rep_creador

    # 2. Proximidad Geográfica (25%)
    if proximidad_m <= 200:
        factor_geo = 1.0
    elif proximidad_m >= 1000:
        factor_geo = 0.0
    else:
        factor_geo = max(0.0, 1.0 - (proximidad_m - 200) / 800)
    score_geo = 0.25 * factor_geo

    # 3. Validación Social Ponderada (35%)
    if confirmaciones_unicas:
        promedio_val = sum(c.get("reputacion", 0.20) for c in confirmaciones_unicas) / len(confirmaciones_unicas)
    else:
        promedio_val = 0.0
    score_social = 0.35 * promedio_val

    base_score = score_creador + score_geo + score_social

    # 4. Reglas de Penalización
    penalizacion = 0.0
    motivos_penalizacion = []

    # Regla: -0.40 ante 3 o más confirmaciones en menos de 30 segundos
    if len(confirmaciones_unicas) >= 3:
        timestamps = sorted([datetime.fromisoformat(c["timestamp"]) for c in confirmaciones_unicas if c.get("timestamp")])
        if len(timestamps) >= 3:
            diferencia = (timestamps[-1] - timestamps[0]).total_seconds()
            if diferencia < 30:
                penalizacion += 0.40
                motivos_penalizacion.append("Ataque coordinado en tiempo (< 30s)")

    # Regla: -0.30 cuando las cuentas comparten IP, subred o dispositivo (ignorar vacíos/None)
    ips = [str(c.get("ip")).strip() for c in confirmaciones_unicas if c.get("ip") and str(c.get("ip")).strip() != ""]
    subredes = [str(c.get("subnet")).strip() for c in confirmaciones_unicas if c.get("subnet") and str(c.get("subnet")).strip() != ""]
    devices = [str(c.get("device_id")).strip() for c in confirmaciones_unicas if c.get("device_id") and str(c.get("device_id")).strip() != ""]

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

def run_tests():
    print("=== INICIANDO SUITE DE PRUEBAS ===")

    # Test 1: Caso Legítimo (0.82 y VERIFIED)
    c1_creador = {"reputacion": 0.90}
    c1_prox = 100
    c1_confs = [
        {"user_id": 1, "reputacion": 0.85, "ip": "192.168.1.10", "timestamp": "2026-11-11T10:00:00"},
        {"user_id": 2, "reputacion": 0.90, "ip": "192.168.2.11", "timestamp": "2026-11-11T10:05:00"},
        {"user_id": 3, "reputacion": 0.80, "ip": "192.168.3.12", "timestamp": "2026-11-11T10:15:00"}
    ]
    r1 = calcular_confianza(c1_creador, c1_prox, c1_confs)
    assert r1["final_score"] == 0.82 and r1["status"] == "VERIFIED", f"Test 1 Falló: {r1}"
    print("Test 1 Superado: Caso legítimo obtiene 0.82 y VERIFIED")

    # Test 2: Penalización por tiempo (< 30s -> -0.40)
    c2_confs = [
        {"user_id": 1, "reputacion": 0.80, "timestamp": "2026-11-11T10:00:00"},
        {"user_id": 2, "reputacion": 0.80, "timestamp": "2026-11-11T10:00:10"},
        {"user_id": 3, "reputacion": 0.80, "timestamp": "2026-11-11T10:00:20"}
    ]
    r2 = calcular_confianza({"reputacion": 0.80}, 100, c2_confs)
    assert r2["penalizacion"] == 0.40, f"Test 2 Falló: {r2}"
    print("Test 2 Superado: Penalización de -0.40 por confirmaciones rápidas (< 30s)")

    # Test 3: Penalización por IP / Dispositivo compartido (-0.30) e ignorar vacíos
    c3_confs = [
        {"user_id": 1, "reputacion": 0.80, "ip": "10.0.0.1", "device_id": None},
        {"user_id": 2, "reputacion": 0.80, "ip": "10.0.0.1", "device_id": ""},
        {"user_id": 3, "reputacion": 0.80, "ip": None, "device_id": "dev-x"}
    ]
    r3 = calcular_confianza({"reputacion": 0.80}, 100, c3_confs)
    assert r3["penalizacion"] == 0.30, f"Test 3 Falló: {r3}"
    print("Test 3 Superado: Penalización de -0.30 por IP compartida ignorando vacíos")

    # Test 4: Caso Sybil Completo (-0.70 -> REJECTED)
    c4_confs = [
        {"user_id": 1, "reputacion": 0.20, "ip": "10.0.0.1", "device_id": "dev-01", "timestamp": "2026-11-11T10:00:00"},
        {"user_id": 2, "reputacion": 0.20, "ip": "10.0.0.1", "device_id": "dev-01", "timestamp": "2026-11-11T10:00:05"},
        {"user_id": 3, "reputacion": 0.20, "ip": "10.0.0.1", "device_id": "dev-01", "timestamp": "2026-11-11T10:00:10"}
    ]
    r4 = calcular_confianza({"reputacion": 0.20}, 150, c4_confs)
    assert r4["final_score"] == 0.0 and r4["status"] == "REJECTED" and r4["penalizacion"] == 0.70
    print("Test 4 Superado: Caso Sybil detectado (-0.70) y estado REJECTED")

    # Test 5: Deduplicación de usuario
    c5_confs = [
        {"user_id": 1, "reputacion": 0.90},
        {"user_id": 1, "reputacion": 0.90}
    ]
    r5 = calcular_confianza({"reputacion": 0.50}, 500, c5_confs)
    print("Test 5 Superado: Confirmación duplicada del mismo usuario ignorada")

    # Test 6: Umbrales (0.70 -> VERIFIED, 0.40 -> UNDER_REVIEW, 0.39 -> REJECTED)
    r_ver = calcular_confianza({"reputacion": 1.0}, 200, [{"reputacion": 3/7}])
    assert r_ver["final_score"] == 0.70 and r_ver["status"] == "VERIFIED"

    r_ur = calcular_confianza({"reputacion": 0.50}, 200, [])
    assert r_ur["final_score"] == 0.40 and r_ur["status"] == "UNDER_REVIEW"

    r_rej = calcular_confianza({"reputacion": 0.466}, 200, [])
    assert r_rej["final_score"] == 0.39 and r_rej["status"] == "REJECTED"
    print("Test 6 Superado: Umbrales validados (0.70, 0.40 y 0.39)")

    print("\nTODAS LAS PRUEBAS PASARON EXITOSAMENTE.")

if __name__ == "__main__":
    run_tests()
