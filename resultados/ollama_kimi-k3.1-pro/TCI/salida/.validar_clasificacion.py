import json
from pathlib import Path

ROOT = Path(__file__).parent
SOURCE = ROOT / "incidencias.jsonl"
OUTPUT = ROOT / "clasificacion.jsonl"
TYPES = {"bug", "enhancement", "documentation"}
SURFACES = {"app", "CLI", "extension", "codex-web", "iOS"}
AREAS = {
    "windows-os", "sandbox", "app-server", "connectivity", "TUI", "session",
    "rate-limits", "tool-calls", "browser", "remote", "model-behavior",
    "performance", "mcp", "auth", "context", "subagent", "config", "computer-use",
}
KEYS = {"id", "tipo", "superficie", "areas"}

source = [json.loads(line) for line in SOURCE.read_text(encoding="utf-8").splitlines() if line.strip()]
result = [json.loads(line) for line in OUTPUT.read_text(encoding="utf-8").splitlines() if line.strip()]
assert len(result) == len(source), (len(result), len(source))
assert len({row["id"] for row in result}) == len(result), "IDs duplicados"
for number, (original, row) in enumerate(zip(source, result), 1):
    assert set(row) == KEYS, (number, "claves", set(row))
    assert row["id"] == original["id"], (number, row["id"], original["id"])
    assert row["tipo"] in TYPES, (number, "tipo", row["tipo"])
    assert row["superficie"] in SURFACES, (number, "superficie", row["superficie"])
    assert isinstance(row["areas"], list), (number, "areas no es array")
    assert len(row["areas"]) == len(set(row["areas"])), (number, "áreas duplicadas")
    assert set(row["areas"]) <= AREAS, (number, "áreas inválidas", set(row["areas"]) - AREAS)

# Los duplicados exactos deben recibir la misma clasificación.
by_content = {}
for original, row in zip(source, result):
    content = (original["titulo"], original["texto"])
    classification = {key: row[key] for key in KEYS - {"id"}}
    if content[1] and content in by_content:
        assert by_content[content][1] == classification, (
            "Duplicados con clasificación distinta", by_content[content][0], row["id"]
        )
    else:
        by_content[content] = (row["id"], classification)

print(f"OK: {len(result)} incidencias; ids, orden, esquema, vocabularios y duplicados exactos validados.")
