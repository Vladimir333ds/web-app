"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { AircraftProvider, ProviderError } = require("../services/aircraftProvider");

test("provider normalizes aircraft and caches successful searches briefly", async () => {
  let calls = 0;
  let now = 1_000;
  const provider = new AircraftProvider({
    now: () => now,
    ttlMs: 1_000,
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({
        total: 2,
        ac: [
          { hex: "abc123", flight: "TEST  ", lat: 50.1, lon: 8.6, track: 90 },
          { hex: "invalid", lat: null, lon: 8.6 }
        ]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });

  const first = await provider.findByPoint(50.1, 8.6, 25);
  const second = await provider.findByPoint(50.1, 8.6, 25);
  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(first.total, 2);
  assert.equal(first.aircraft.length, 1);
  assert.equal(first.aircraft[0].callsign, "TEST");

  now += 1_001;
  await provider.findByPoint(50.1, 8.6, 25);
  assert.equal(calls, 2);
});

test("provider converts upstream rate limiting into a retry-aware error", async () => {
  const provider = new AircraftProvider({
    fetchImpl: async () => new Response("", {
      status: 429,
      headers: { "retry-after": "60" }
    })
  });
  await assert.rejects(
    provider.findByPoint(50, 8, 25),
    error => error instanceof ProviderError && error.status === 503 && error.retryAfter === "60"
  );
});
