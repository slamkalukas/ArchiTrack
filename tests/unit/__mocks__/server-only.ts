// No-op stand-in for the `server-only` package during Vitest runs. Next.js's bundler
// normally makes importing "server-only" from client code a build error; that guarantee
// isn't relevant inside a Node-based unit test, so we alias it away (see vitest.config.ts).
export {};
