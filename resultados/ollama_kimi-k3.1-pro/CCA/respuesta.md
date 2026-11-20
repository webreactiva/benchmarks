Voy a crear una versión en Python, sin dependencias externas, con catálogo inyectable, importes precisos y pruebas automatizadas.

---

La estructura será `models/`, `service/`, `tests/` y `main.py`. El carrito dependerá de una interfaz de catálogo, no de una lista global.

---

El dominio ya está implementado: consolida productos repetidos, valida cantidades y stock, evita mezclar monedas y calcula totales con `Decimal`. Ahora añado las pruebas y el ejemplo ejecutable.

---

Ejecuto ahora la batería de pruebas y el ejemplo de `main.py` para comprobar ambos recorridos.

---

Implementado en la carpeta actual un carrito de compra en **Python**, sin dependencias externas.

### Componentes
- `models/carrito.py`: operaciones para añadir, actualizar, quitar, vaciar y calcular totales.
- `models/producto.py`: producto con validación de precio, moneda y stock.
- `models/item_carrito.py`: cantidades y subtotales.
- `service/producto_service.py`: catálogo inyectable y actualización de stock.
- `tests/test_carrito.py`: pruebas del flujo completo y casos límite.
- `main.py`: ejemplo ejecutable.

Incluye consolidación de productos repetidos, validación de stock, prevención de importes negativos, redondeo monetario con `Decimal` y control de monedas mixtas.

### Verificación
- **17 pruebas ejecutadas correctamente**.
- Ejemplo verificado con un total de **210,80 EUR**.

```bash
python3 main.py
python3 -m unittest discover -s tests -v
```
