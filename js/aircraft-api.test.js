"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const AircraftApiClient = require("./aircraft-api");
const { LiveAircraft } = require("./aircraft-api");

test("nautical mile map range converts to metres", () => {
  assert.equal(AircraftApiClient.nauticalMilesToMeters(250), 463_000);
});

test("map range rejects values outside the provider's supported limit", () => {
  assert.throws(() => AircraftApiClient.nauticalMilesToMeters(0), RangeError);
  assert.throws(() => AircraftApiClient.nauticalMilesToMeters(251), RangeError);
});

test("client sends range in nautical miles and validates response", async () => {
  let requestedUrl = "";
  const client = new AircraftApiClient({
    baseUrl: "https://example.test/",
    fetchImpl: async url => {
      requestedUrl = url;
      return new Response(JSON.stringify({ total: 0, aircraft: [] }), { status: 200 });
    }
  });
  await client.search(50, 8, 25);
  assert.equal(requestedUrl, "https://example.test/aircraft-live/50/8/25");
});

test("live aircraft model uses inheritance and provides a callsign label", async () => {
  const client = new AircraftApiClient({
    baseUrl: "https://example.test",
    fetchImpl: async () => new Response(JSON.stringify({
      total: 1,
      aircraft: [{ icao: "abc123", callsign: "TEST", lat: 50, lon: 8 }]
    }), { status: 200 })
  });
  const result = await client.search(50, 8, 25);
  assert.ok(result.aircraft[0] instanceof LiveAircraft);
  assert.equal(result.aircraft[0].markerLabel, "TEST");
  assert.equal(result.aircraft[0].lat, 50);
});

test("default fetch keeps its global receiver when called by the client", async () => {
  const originalFetch = globalThis.fetch;
  let receiver;
  globalThis.fetch = function (url) {
    receiver = this;
    return Promise.resolve(new Response(JSON.stringify({ total: 0, aircraft: [] }), { status: 200 }));
  };
  try {
    const client = new AircraftApiClient({ baseUrl: "https://example.test" });
    await client.search(50, 8, 25);
    assert.equal(receiver, globalThis);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
