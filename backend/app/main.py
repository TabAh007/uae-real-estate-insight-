from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import geocode, neighborhood, properties, valuation
from app.services import dld_csv

app = FastAPI(
    title="UAE Real Estate Insight API",
    description="Comparable-sales valuation, DLD transaction data, and neighborhood POIs for UAE properties.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(geocode.router)
app.include_router(neighborhood.router)
app.include_router(properties.router)
app.include_router(valuation.router)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "dubai_pulse_configured": settings.dubai_pulse_configured,
        "geoapify_configured": settings.geoapify_configured,
        "dld_csv_rows": len(dld_csv.TRANSACTIONS),
    }
