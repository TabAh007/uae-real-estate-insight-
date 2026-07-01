# DLD data drop folder

Put Dubai Land Department open-data CSV exports here. Any `*.csv` file in this
folder is loaded automatically on backend startup (no API credentials needed).

## How to get a CSV (zero registration)

1. Open https://dubailand.gov.ae/en/open-data/real-estate-data/
2. Under **Transaction Details**, pick a From/To date range (and optionally an
   Area / Property Type), pass the reCAPTCHA, and click **Search**.
3. Click **Download as CSV**.
4. Drop the downloaded file in this folder and restart the backend.

`/health` will then report `dld_csv_rows` > 0 and `/properties/transactions`
+ `/valuation/estimate` will serve the real data instead of the bundled sample.

## Expected columns

The loader maps these DLD column headers (English portal). If a future export
renames a column, adjust `COLUMN_MAP` in `app/services/dld_csv.py`:

- `Transaction Date`, `Area`, `Property Type`, `Property Sub Type`
- `Amount` (price in AED), `Property Size (sq.m)`, `Room(s)`

Rows missing a price or size are skipped. `.csv` files here are gitignored so
you don't commit bulk data.
