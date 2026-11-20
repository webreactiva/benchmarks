# AIF · ollama/deepseek-v4.1-flash · 0/10

**No entregó nada.** Carpeta vacía.

## Qué pasó
- 4 peticiones. Miró su carpeta (vacía), salió a buscar contexto por el disco, leyó la portada de webreactiva.com y se puso a escribir el HTML en una sola llamada.
- Esa última respuesta llegó a 32 000 tokens de salida y terminó con `finish: length`: la llamada a `write` no llegó a ejecutarse.

## Rarezas de la sesión
- **Curioseó fuera de su carpeta**: `ls /tmp/bench-ws` y `find /tmp/bench-ws` le enseñaron los ficheros de los otros modelos (los de Haiku y nemotron). Razonó que mirarlos «might be considered cheating» y no los abrió (comprobado con `scripts/fugas.py`). Por esta sesión, ahora cada prueba corre encerrada con `scripts/encierro.sh`: no ve el repo, ni `/tmp`, ni otros procesos.
- `find / -maxdepth 3 -iname '*reactiva*'` y `cat /container_info.json`, buscando de qué iba el encargo.
- Leyó webreactiva.com y sacó contenido bueno («malandriner», «En pantuflas», SDD, skills, MCP), que no llegó a usar.
- El tope de 32 000 tokens de salida es el que OpenCode pone por defecto a un proveedor sin `limit`.
