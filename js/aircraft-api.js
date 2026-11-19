(function (root) {
  "use strict";

  class Aircraft {
    #icao;
    #latitude;
    #longitude;

    constructor({ icao = "", lat, lon }) {
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
        throw new TypeError("Aircraft coordinates must be numeric");
      }
      this.#icao = String(icao);
      this.#latitude = Number(lat);
      this.#longitude = Number(lon);
    }

    get icao() { return this.#icao; }
    get lat() { return this.#latitude; }
    get lon() { return this.#longitude; }
    get markerLabel() { return this.#icao || "Unknown aircraft"; }
  }

  class LiveAircraft extends Aircraft {
    #callsign;
    #heading;
    #baroAltitude;
    #speed;
    #registration;
    #type;

    constructor(data) {
      super(data);
      this.#callsign = String(data.callsign || "").trim();
      this.#heading = Number(data.heading) || 0;
      this.#baroAltitude = data.baroAltitude ?? null;
      this.#speed = data.speed ?? null;
      this.#registration = String(data.reg || "");
      this.#type = String(data.type || "");
    }

    get callsign() { return this.#callsign; }
    get heading() { return this.#heading; }
    get baroAltitude() { return this.#baroAltitude; }
    get speed() { return this.#speed; }
    get reg() { return this.#registration; }
    get type() { return this.#type; }
    get markerLabel() { return this.#callsign || super.markerLabel; }
  }

  class AircraftApiClient {
    constructor({ baseUrl, fetchImpl = root.fetch } = {}) {
      if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required");
      this.baseUrl = (baseUrl || "").replace(/\/$/, "");
      // Native window.fetch requires its Window receiver; retain it when the
      // function is stored on this client. Injected test fetchers stay intact.
      this.fetchImpl = fetchImpl === root.fetch ? fetchImpl.bind(root) : fetchImpl;
    }

    static nauticalMilesToMeters(radiusNm) {
      const value = Number(radiusNm);
      if (!Number.isFinite(value) || value < 1 || value > 250) {
        throw new RangeError("Range must be between 1 and 250 nautical miles");
      }
      return value * 1852;
    }

    async search(lat, lon, radiusNm) {
      const latitude = Number(lat);
      const longitude = Number(lon);
      const radius = Math.round(Number(radiusNm));
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new RangeError("Choose valid latitude and longitude coordinates");
      }
      AircraftApiClient.nauticalMilesToMeters(radius);
      if (!this.baseUrl) throw new Error("Aircraft API URL is not configured");

      const response = await this.fetchImpl(
        `${this.baseUrl}/aircraft-live/${latitude}/${longitude}/${radius}`,
        { headers: { Accept: "application/json" } }
      );
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`Aircraft API returned invalid JSON (HTTP ${response.status})`);
      }
      if (!response.ok) throw new Error(payload?.error || `Aircraft API returned HTTP ${response.status}`);
      if (!Array.isArray(payload?.aircraft)) throw new Error("Aircraft API returned an unexpected response");
      return {
        ...payload,
        aircraft: payload.aircraft.map(plane => new LiveAircraft(plane))
      };
    }
  }

  root.AircraftApiClient = AircraftApiClient;
  root.Aircraft = Aircraft;
  root.LiveAircraft = LiveAircraft;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = AircraftApiClient;
    module.exports.Aircraft = Aircraft;
    module.exports.LiveAircraft = LiveAircraft;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
