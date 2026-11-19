"use strict";

const DEFAULT_TTL_MS = 15_000;
const MAX_CACHE_ENTRIES = 250;

class ProviderError extends Error {
  constructor(message, { status = 502, retryAfter = null } = {}) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/** Small adapter around ADSB.lol. Coalesces identical requests and caches successes briefly. */
class AircraftProvider {
  constructor({ fetchImpl = globalThis.fetch, apiKey = process.env.ADSBLOL_API_KEY, ttlMs = DEFAULT_TTL_MS, now = Date.now } = {}) {
    if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required");
    this.fetchImpl = fetchImpl;
    this.apiKey = apiKey;
    this.ttlMs = ttlMs;
    this.now = now;
    this.cache = new Map();
    this.inFlight = new Map();
  }

  async findByPoint(lat, lon, radiusNm) {
    const key = `${lat.toFixed(4)}:${lon.toFixed(4)}:${radiusNm}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now()) return cached.value;
    if (this.inFlight.has(key)) return this.inFlight.get(key);

    const request = this.fetchPoint(lat, lon, radiusNm)
      .then(value => {
        this.cache.set(key, { value, expiresAt: this.now() + this.ttlMs });
        while (this.cache.size > MAX_CACHE_ENTRIES) {
          this.cache.delete(this.cache.keys().next().value);
        }
        return value;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, request);
    return request;
  }

  async fetchPoint(lat, lon, radiusNm) {
    let response;
    try {
      response = await this.fetchImpl(
        `https://api.adsb.lol/v2/point/${lat}/${lon}/${radiusNm}`,
        {
          headers: {
            Accept: "application/json",
            ...(this.apiKey ? { "x-api-key": this.apiKey } : {})
          },
          signal: AbortSignal.timeout(10_000)
        }
      );
    } catch (error) {
      // Log transport classification only; never log headers, API keys, or coordinates.
      console.warn("ADSB.lol network request failed", {
        name: error?.name || "Error",
        code: error?.code || "",
        causeCode: error?.cause?.code || error?.cause?.name || ""
      });
      throw new ProviderError("Unable to reach the aircraft data provider", { status: 503 });
    }

    const retryAfter = response.headers.get("retry-after");
    if (response.status === 429) {
      // Keep logs free of response bodies and request-specific data.
      console.warn("ADSB.lol rate limit reached", retryAfter ? `Retry-After: ${retryAfter}` : "");
      throw new ProviderError("Aircraft provider rate limit reached", { status: 503, retryAfter });
    }
    if (!response.ok) {
      console.warn(`ADSB.lol returned HTTP ${response.status}`);
      throw new ProviderError(`Aircraft provider returned HTTP ${response.status}`, { status: 502 });
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new ProviderError("Aircraft provider returned invalid JSON", { status: 502 });
    }
    if (!data || (data.ac !== undefined && !Array.isArray(data.ac))) {
      throw new ProviderError("Aircraft provider returned an unexpected response", { status: 502 });
    }

    const aircraft = (data.ac || [])
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .map(p => ({
        icao: String(p.hex || ""),
        callsign: String(p.flight || "").trim(),
        lat: p.lat,
        lon: p.lon,
        heading: p.track ?? p.true_heading ?? 0,
        baroAltitude: p.alt_baro ?? null,
        speed: p.gs ?? null,
        reg: String(p.r || ""),
        type: String(p.t || "")
      }));

    return { total: Number.isFinite(data.total) ? data.total : aircraft.length, aircraft };
  }
}

module.exports = { AircraftProvider, ProviderError };
