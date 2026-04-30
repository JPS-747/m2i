# Bank & System File Matching Dashboard

This is a React + Vite admin dashboard for matching and reconciling Bank and System files. It provides tools for uploading, mapping, and matching transactions, with a focus on financial period management.

## Features

- Upload and preview Bank and System files
- Map columns and apply transformations
- Match transactions using configurable panels
- View matching progress and statistics in real time
- Admin dashboard with period actions (open, close, activate)
- Modular, responsive UI with reusable components
- Environment-based API configuration

# Customizing File Import and Match Type Settings

## Customizing File Import (Selecting Columns & Using Functions)

When importing files (System or Bank) via the API (`POST /files/system/import` or `POST /files/bank/import`), you can:

- **Select Columns:**
  - The import process allows you to map CSV columns to database fields. You can specify which columns to import and how they should be mapped. This is typically handled in the frontend (e.g., via a column mapping UI) and sent to the backend as part of the import request.

- **Use Additional Functions:**
  - You can apply transformation functions to columns during import. For example, you might want to trim whitespace, convert date formats, or apply custom logic to certain fields. These functions can be defined in the backend and referenced in the import configuration.

**Example (frontend):**
- The import dialog lets you select which CSV columns map to which database fields.
- You can optionally specify transformation functions for each column (e.g., `toUpperCase`, `parseDate`).

**Example (backend):**
- The backend receives a mapping and transformation config, applies the functions, and imports the data accordingly.

## Configuring a MatchType Setting

The `MatchTypeSetting` model (see `backend/app/models/match_type_setting.py`) stores configuration for different match types used in reconciliation.

**Key fields:**
- `key`: Unique identifier for the match type.
- `title`: Human-readable name.
- `description`: Description of the match type.
- `type`: The type/category of match (e.g., "exact", "fuzzy").
- `parameters`: JSON string for additional settings (e.g., which columns to match, thresholds, etc.).
- `is_active`: Whether this match type is currently enabled.

**How to configure:**
1. **Create or update a MatchTypeSetting** via the admin UI or directly in the database.
2. **Set the `parameters` field** with a JSON object specifying:
   - Which columns to use for matching.
   - Any thresholds or custom logic.
   - Example:
     ```json
     {
       "columns": ["amount", "date", "reference"],
       "threshold": 0.95,
       "customFunction": "normalizeReference"
     }
     ```
3. **Activate or deactivate** the match type as needed.

**Usage:**
- The matching engine will use the active `MatchTypeSetting` configurations to determine how transactions are matched.



## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation
1. Clone the repository and navigate to the frontend folder:
  ```sh
  cd frontend
  ```
2. Install dependencies:
  ```sh
  npm install
  ```
3. Copy the example environment file and set your API URL if needed:
  ```sh
  cp .env.example .env
  # or on Windows
  Copy-Item .env.example .env
  ```
  Default: `VITE_API_BASE_URL=http://127.0.0.1:8000`

### Running the App
```sh
npm run dev
```
Open [http://127.0.0.1:8050](http://127.0.0.1:8050) (or the port you set) in your browser.

### Building for Production
```sh
npm run build
npm run preview
```

## Project Structure
- `src/components/` — UI components (matching panels, file tables, modals)
- `src/pages/` — Main app pages (Dashboard, Matching, BankFiles, SystemFiles, etc.)
- `src/api/` — API service modules
- `src/hooks/` — Custom React hooks
- `src/layout/` — Layout components (Sidebar, Topbar, etc.)
- `src/styles/` — CSS modules

## Matching Workflow
1. **Import Files:** Upload Bank and System files on their respective pages.
2. **Map Columns:** Use the column mapper to align file columns with system fields.
3. **Apply Transformations:** Optionally apply transformations to data before matching.
4. **Run Matching:** Use the Matching page to match transactions and review results.
5. **Review & Export:** View match statistics and export results as needed.

## Environment Variables
- `VITE_API_BASE_URL` — Backend API URL
- `VITE_PORT` — Frontend port (default: 8050)
- `VITE_URL` — Frontend host (default: 127.0.0.1)

## License
MIT
```
