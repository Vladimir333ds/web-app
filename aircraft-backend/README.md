# Aircraft Tracker backend

## Local development

1. Install Node.js 18 or newer and run `npm install` in this directory.
2. Set the variables listed in `.env.example` in the terminal or your IDE's run configuration. Use the Railway MySQL connection values; do not commit a real `.env` file.
3. Set `JWT_SECRET` to a newly generated random value of at least 32 characters. Changing it invalidates tokens signed with the old hard-coded key, so users will need to sign in again.
4. Set `ALLOWED_ORIGINS` to the exact origin serving the frontend, including scheme and port. For local development with `python -m http.server 8000`, include `http://localhost:8000`.
5. Run `npm start`. The frontend selects `http://localhost:3000` when opened from localhost.

## Render deployment

Configure the same database variables in Render from the Railway connection settings. Add a new `JWT_SECRET` in Render's environment settings and set `ALLOWED_ORIGINS` to the deployed frontend's exact origin(s). Render supplies `PORT` automatically. Do not paste credentials into source files or commit them.

The browser calls this backend. The backend then calls ADSB.lol. Browsers cannot read ADSB.lol directly unless that provider enables CORS for the website. A short in-memory cache (15 seconds) and request coalescing reduce duplicate upstream requests on a single backend instance; they do not bypass ADSB.lol's limits. The provider documents 500 requests/day per IP without a key, with higher tiers available; quota resets at 00:00 UTC. Configure an optional `ADSBLOL_API_KEY` in Render/local environment settings without committing it. Upstream HTTP 429 is returned to the browser as HTTP 503 with `Retry-After` when provided.

## Aircraft search API

`GET /aircraft-live/:lat/:lon/:range` accepts latitude, longitude, and a range from 1 to 250 **nautical miles**. The result is `{ total, aircraft }`; `total` is provider-reported and may be larger than the number of aircraft with position data.

Run `npm test` for provider, cache, model, and unit-conversion checks.
