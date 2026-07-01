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

## Rental yield: also drop a Rent Contracts CSV

To enable `/valuation/rental-yield`, download a second CSV from the same page:
under **Rent Transaction Details**, pick a date range and click **Download as
CSV**, then drop it in this folder too. Sales and rent files coexist here — the
loaders tell them apart by their column headers (a rent file has an
`ANNUAL_AMOUNT`/`CONTRACT_AMOUNT` column and no sale-price column), so no
renaming is needed. Gross yield = median annual rent ÷ median sale price for
size-matched comparable units.

## KHDA school ratings (optional)

To show rated schools near a property, download **Dubai's Private Schools Open
Data** (an `.xlsx`) from
https://web.khda.gov.ae/en/Resources/KHDA-data-statistics and drop it in this
folder. It carries each school's coordinates, curriculum, and DSIB inspection
rating per year; the app surfaces each school's most recent rating via
`/neighborhood/schools`. `/health` will report `khda_schools` > 0.

## Expected columns

The loader maps these DLD column headers (English portal). If a future export
renames a column, adjust `COLUMN_MAP` in `app/services/dld_csv.py`:

- `Transaction Date`, `Area`, `Property Type`, `Property Sub Type`
- `Amount` (price in AED), `Property Size (sq.m)`, `Room(s)`

Rows missing a price or size are skipped. `.csv` files here are gitignored so
you don't commit bulk data.
