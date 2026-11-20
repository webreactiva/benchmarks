from __future__ import annotations

import argparse

from .api.http import CartHTTPServer, build_service


def main() -> None:
    parser = argparse.ArgumentParser(prog="cart", description="API HTTP del carrito de la compra")
    parser.add_argument("--host", default="127.0.0.1", help="dirección de escucha")
    parser.add_argument("--port", type=int, default=8000, help="puerto de escucha")
    args = parser.parse_args()
    server = CartHTTPServer((args.host, args.port), build_service())
    print(f"API del carrito escuchando en http://{args.host}:{args.port} (endpoints: /health, /products, /carts)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
