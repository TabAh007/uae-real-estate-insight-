# UAE Real Estate Insight

Given a property, tells you whether it's priced high or low against comparable DLD transactions, plus what's nearby.

**Live:** https://frontend-mocha-seven-45yiyz34l3.vercel.app (backend: https://backend-theta-mocha-yle4qa6373.vercel.app)

## Architecture

- `backend/` — FastAPI. Comparable-sales valuation, DLD transaction lookup, OSM neighborhood/POI search, Geoapify geocoding.
- `frontend/` — Next.js + TypeScript + MapLibre. Address search, valuation form, interactive map.

## Deploying

See [DEPLOY.md](DEPLOY.md) — backend to Render/Docker, frontend to Vercel, with env-var wiring.

## Data sources

- **DLD CSV** (recommended) — download from dubailand.gov.ae open data and drop into `backend/data/`. See `backend/data/README.md`.
- **Dubai Pulse API** (optional) — register at dubaipulse.gov.ae, fill `backend/.env`.
- **OpenStreetMap Overpass** — live, powers "what's nearby."
- **KHDA schools XLSX** (optional) — drop into `backend/data/` for school ratings.
- **Geoapify** — required for geocoding; sign up at geoapify.com.

Priority order: Dubai Pulse → DLD CSV → bundled sample data. `/health` reports which is active.

Note: this project doesn't scrape Bayut/Property Finder/Dubizzle (against their ToS). Live listing aggregation would need a licensed data provider or agency partnership.

## Running locally

**Backend**
```
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --port 8010 --reload
```
Docs at http://localhost:8010/docs.

**Frontend**
```
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
Open http://localhost:3000.

## Roadmap

- Phase 1: comparable-sales valuation, live OSM neighborhood search, map view.
- Phase 2 (done): real DLD sales/rent data, rental yield, KHDA ratings, Geoapify fallback.
- Phase 3 (done): investment score, price-trend chart, UI polish, deployment configs.
- Later: live listings aggregation via licensed provider, conversational layer.

## A note on valuation numbers

`/valuation/estimate` returns a range (low/median/high from comparables), never a single point estimate — by design.
