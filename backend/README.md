# FastAPI + MariaDB Financial Period Backend

This project provides a FastAPI backend connected to a MariaDB database with a `financial_periods` table and these core actions:

- Close period (and auto-generate next period)
- Activate period
- Open period

## 1) Setup

### Create and activate virtual environment (Windows PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Install dependencies

```powershell
pip install -r requirements.txt
```

### Configure environment

Copy `.env.example` to `.env` and update values.

```powershell
Copy-Item .env.example .env
```

### Prepare database schema

Run `sql/init.sql` in your MariaDB server.

## 2) Run API

```powershell
uvicorn main:app --reload
```

Open Swagger UI at: `http://127.0.0.1:8000/docs`



## 3) API Endpoints

### `POST /periods/close`

Close a period and auto-create the next one if missing.

Request body:

```json
{
  "period": "202603"
}
```

### `POST /periods/activate`

Activate a period. Any currently active period is set back to `open`.

Request body:

```json
{
  "period": "202604"
}
```

### `POST /periods/open`

Open period status to `open`. If next period was auto-created and untouched, it is removed.

Request body:

```json
{
  "period": "202603"
}
```

### `GET /periods/latest`

Returns latest period by period key. If table is empty, creates current month as first active row.

### `GET /periods/latest-12`

Returns the latest 12 periods ordered by period descending. If table is empty, creates current month as first active row.

### `GET /files/system`

Returns per-file import summaries for `Source = System` from the `transactions` table.

### `GET /files/bank`

Returns per-file import summaries for `Source = Bank` from the `transactions` table.

### `POST /files/system/import`

Imports a System CSV file into `transactions` for the current open period.

### `POST /files/bank/import`

Imports a Bank CSV file into `transactions` for the current open period.

### `POST /files/system/delete`

Deletes all `transactions` rows for a selected System file (by `file_origin` + `file_index`) in the current open period.

### `POST /files/bank/delete`

Deletes all `transactions` rows for a selected Bank file (by `file_origin` + `file_index`) in the current open period.

> Import is allowed only when there is an open financial period.

### `GET /health`

Simple health endpoint.

## Notes

- Period format expected by API: `YYYYMM` (e.g., `202603`).
- Table column uses `varchar(7)` as requested, and stores `YYYYMM` values.
- SQLAlchemy runs `create_all` on startup, so table can be auto-created if DB exists.
