# Deploying UAE Real Estate Insight

Two pieces to deploy:

- **Backend** (FastAPI) → Render (or any Docker host — Railway, Fly, etc.)
- **Frontend** (Next.js) → Vercel

Deploy the backend first so you have its URL for the frontend's config.

---

## 1. Backend → Render

1. Push this repo to GitHub (see "Pushing to GitHub" below).
2. In Render: **New → Blueprint**, select the repo. Render reads
   [`render.yaml`](render.yaml) and creates the `uae-real-estate-api` service
   (native Python, free plan, root dir `backend`, health check `/health`).
3. After the first deploy, set env vars on the service:
   - `CORS_ORIGINS` = your frontend origin, e.g. `https://your-app.vercel.app`
     (add `http://localhost:3000` too if you still develop locally).
   - `GEOAPIFY_API_KEY` = your Geoapify key (enables address search + POI
     fallback). Optional but recommended.
   - `DATA_DIR` — see **Real data in production** below. Leave unset to run on
     bundled sample data.
4. Redeploy. Visit `https://<your-service>.onrender.com/health` — it should
   return `{"status":"ok", ...}`.

**Docker alternative (Railway / Fly / any):** [`backend/Dockerfile`](backend/Dockerfile)
builds a standalone image that honours `$PORT`. Point your platform at it and
set the same env vars.

> Render's free plan sleeps after inactivity, so the first request after idle
> takes ~30s to wake. Fine for a demo; upgrade the plan for always-on.

---

## 2. Frontend → Vercel

1. In Vercel: **Add New → Project**, import the same repo.
2. Set **Root Directory** to `frontend` (Vercel auto-detects Next.js there).
3. Add an environment variable:
   - `NEXT_PUBLIC_API_BASE_URL` = your Render backend URL, e.g.
     `https://uae-real-estate-api.onrender.com`
4. Deploy. Vercel gives you `https://your-app.vercel.app`.
5. **Back on Render**, make sure `CORS_ORIGINS` includes that exact Vercel URL,
   then redeploy the backend. (The browser calls the API cross-origin, so the
   origin must be allow-listed.)

---

## Real data in production

The DLD CSVs and KHDA XLSX are **gitignored**, so a fresh deploy runs on the
bundled sample data by default (`/health` shows `dld_csv_rows` small and
`khda_schools: 0`). To serve real data you have two options:

- **Render persistent disk (recommended):** add a Disk to the service (e.g.
  mount path `/var/data`), set `DATA_DIR=/var/data`, and upload your
  `transactions-*.csv`, `rents-*.csv`, and `DubaiPrivateSchoolsOpenData.xlsx`
  to it (via a one-off shell or a small upload step). Data then survives
  redeploys.
- **Commit the data:** DLD/KHDA exports are open government data, so you may
  commit them. Remove the relevant lines from `backend/data/.gitignore`, add
  the files, and they'll ship with each deploy. Simplest, but bloats the repo
  and couples data refreshes to code deploys.

See [`backend/data/README.md`](backend/data/README.md) for where to download
each file.

---

## Environment variables reference

**Backend** (Render service env / `backend/.env` locally):

| Var | Required | Purpose |
|---|---|---|
| `CORS_ORIGINS` | yes (prod) | Comma-separated allowed frontend origins |
| `GEOAPIFY_API_KEY` | recommended | Address search + POI fallback |
| `DATA_DIR` | optional | Path to real DLD/KHDA files (else sample data) |
| `DUBAI_PULSE_*` | optional | Use the live DLD API instead of CSVs |

**Frontend** (Vercel env / `frontend/.env.local`):

| Var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | yes | URL of the deployed backend |

---

## Pushing to GitHub

This repo has no remote yet. Create an empty GitHub repo, then:

```bash
git remote add origin https://github.com/<you>/uae-real-estate-insight.git
git push -u origin main
```

Your local `.env` and data files stay out of the push (already gitignored).
