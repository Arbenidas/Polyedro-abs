/** Corre antes de cada archivo de test (vitest setupFiles), así el módulo de
 *  env (@Polyedro-abs/env/server) ve estas variables al validarse. Saltamos la
 *  validación estricta: los tests mockean @/db y los servicios externos, así
 *  que no necesitan credenciales reales. */
process.env.SKIP_ENV_VALIDATION = "true";
process.env.NODE_ENV = "test";
// db/index.ts está mockeado en los tests, pero dejamos una URL válida por si
// algún import lee env.DATABASE_URL en la carga del módulo.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
