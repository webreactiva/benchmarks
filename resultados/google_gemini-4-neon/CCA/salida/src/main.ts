import { createCartHttpServer } from "./api/server.ts";
import { createDefaultCartSystem } from "./bootstrap.ts";

const port = Number(process.env["PORT"] ?? 3000);
const host = process.env["HOST"] ?? "127.0.0.1";
const storageMode = process.env["STORAGE_MODE"] === "file" ? "file" : "memory";
const storageFilePath = process.env["STORAGE_FILE"] ?? "./data/carts.json";

const system = createDefaultCartSystem({ storageMode, storageFilePath });

system.eventBus.subscribeAll((event) => {
  console.info(`[event] ${event.type} cart=${event.cartId} v=${event.cartVersion}`);
});

const server = createCartHttpServer(system.cartService);

server.listen(port, host, () => {
  console.log(
    `Scalable Shopping Cart API escuchando en http://${host}:${port} (storage=${storageMode})`,
  );
});

const shutdown = (): void => {
  console.log("Cerrando servidor...");
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
