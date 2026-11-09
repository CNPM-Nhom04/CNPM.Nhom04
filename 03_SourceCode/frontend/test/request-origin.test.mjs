import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import Module from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const filename = fileURLToPath(
  new URL("../lib/server/requestOrigin.ts", import.meta.url),
);
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(dirname(filename));
compiled._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  filename,
);
const { hasTrustedOrigin } = compiled.exports;
const request = (
  origin,
  host = "127.0.0.1:43100",
  internal = "http://localhost:43100",
  extra = {},
) => ({
  headers: new Headers({ ...extra, host, ...(origin ? { origin } : {}) }),
  nextUrl: { origin: internal },
});
test("accepts direct 127.0.0.1 with its own port when Next normalizes to localhost", () =>
  assert(hasTrustedOrigin(request("http://127.0.0.1:43100"), {})));
test("accepts exact same origin", () =>
  assert(hasTrustedOrigin(request("http://localhost:43100"), {})));
test("requires explicit origin behind a proxy", () => {
  const r = request(
    "https://ctdt.example.edu",
    "internal:3000",
    "http://internal:3000",
  );
  assert(!hasTrustedOrigin(r, {}));
  assert(hasTrustedOrigin(r, { appOrigin: "https://ctdt.example.edu" }));
});
test("configured origins exclude implicit internal and loopback origins", () => {
  const config = { appOrigin: "https://ctdt.example.edu" };
  assert(!hasTrustedOrigin(request("http://localhost:43100"), config));
  assert(!hasTrustedOrigin(request("http://127.0.0.1:43100"), config));
});
test("rejects cross-origin, missing, null and lookalike origins", () => {
  for (const o of [
    null,
    "null",
    "https://evil.example",
    "http://127.0.0.1:43101",
    "https://ctdt.example.edu.evil",
    "https://ctdt.example.edu/path",
    "https://user@ctdt.example.edu",
  ])
    assert(
      !hasTrustedOrigin(request(o), { appOrigin: "https://ctdt.example.edu" }),
      String(o),
    );
});
test("does not trust spoofed forwarding headers", () =>
  assert(
    !hasTrustedOrigin(
      request("https://evil.example", "internal:3000", "http://internal:3000", {
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      }),
      {},
    ),
  ));
test("supports explicitly listed secondary origins and fails closed on bad config", () => {
  assert(
    hasTrustedOrigin(request("https://qa.example.edu"), {
      appOrigin: "https://ctdt.example.edu",
      trustedOrigins: "https://qa.example.edu",
    }),
  );
  assert(
    !hasTrustedOrigin(request("http://localhost:43100"), {
      appOrigin: "invalid",
    }),
  );
});
