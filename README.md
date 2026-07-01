# UAE Real Estate Insight

Given a property, tells you whether it's priced high or low against comparable
DLD transactions, plus what's nearby. Phase 1 scaffold.

## Architecture

- `backend/` — FastAPI. Comparable-sales valuation, DLD transaction lookup,
  OpenStreetMap-based neighborhood/POI search, Geoapify geocoding.
- `frontend/` — Next.js + TypeScript + MapLibre. Address search, valuation
  form, interactive map.

## Data sources and current status

| Source | Status | Notes |
|---|---|---|
| DLD open-data **CSV** (recommended, zero credentials) | Ready to use | Download a transactions CSV from https://dubailand.gov.ae/en/open-data/real-estate-data/ (Download as CSV — just a reCAPTCHA, no signup) and drop it in `backend/data/`. Loaded on startup. See `backend/data/README.md`. |
| Dubai Pulse / DLD **API** | Optional | The programmatic route. Register at dubaipulse.gov.ae for OAuth credentials and fill `backend/.env`. Note: the portal may Cloudflare-block normal browsers by region; the CSV path above avoids this entirely. |
| OpenStreetMap Overpass | Live, no key needed | Powers "what's nearby." Coverage is strong for metro/malls/landmarks, weaker for residential-area amenities — see `backend/app/services/overpass.py` for the fallback-mirror handling. |
| KHDA schools XLSX | Optional | Drop `DubaiPrivateSchoolsOpenData.xlsx` in `backend/data/` for rated schools near a property (`/neighborhood/schools`). See `backend/data/README.md`. |
| Geoapify | **Not yet configured** | Free tier, sign up at geoapify.com. Needed for address → lat/lon geocoding. |

**Data source priority:** the backend serves the first available of — Dubai
Pulse API (if credentials set) → a DLD CSV in `backend/data/` → bundled sample
data. `/health` reports which is active (`dld_csv_rows`, `dubai_pulse_configured`).
The frontend dropdowns auto-populate from `/properties/facets`, so real
values (e.g. `Flat` vs the sample data's `Apartment`) appear automatically.

Do **not** wire this project up to scrape Bayut, Property Finder, or Dubizzle —
their Terms of Service explicitly prohibit automated collection, and UAE
cybercrime law carries real exposure for ToS-violating access. See the
project's chat history / decision notes for the full reasoning. Live listing
aggregation is a separate business-development track (licensed data
providers like REIDIN/Property Monitor, or direct agency partnerships), not
an engineering task.

## Running locally

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DUBAI_PULSE_* and GEOAPIFY_API_KEY when you have them
uvicorn app.main:app --port 8010 --reload
```

API docs at http://localhost:8010/docs. `/health` reports which external
integrations are configured.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000.

## Roadmap

**Phase 1 (this scaffold):** comparable-sales valuation range on sample
data, live OSM neighborhood search, map view.

**Phase 2 (done):** real DLD sales + rent CSVs, rental-yield, and KHDA school
ratings are all wired in. Remaining: Geoapify Places as a fallback when OSM
POI results are sparse.

**Phase 3 (not started):** live listings aggregation via a licensed data
provider or direct agency partnerships; conversational/chat layer on top of
the valuation and neighborhood data.

## A note on the valuation numbers

The `/valuation/estimate` endpoint intentionally returns a **range** (low/
median/high from comparable transactions) plus the comparables used, never
a single point estimate. Don't change this to a bare number — showing false
precision is how naive AVMs mislead users.
