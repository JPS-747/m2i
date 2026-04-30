# Introduction

Use this system if you have a large amount of bank records that need to be reconciled with your system records. It is specifically created for Life and Short Term insurance companies that process transactions using Debit Orders. The platform is optimized for high-volume, high-speed reconciliation and is ideal for organizations seeking automation and accuracy in financial matching workflows.

# Bank & System File Matching Dashboard

This is a React + Vite admin dashboard for matching and reconciling Bank and System files. It provides tools for uploading, mapping, and matching transactions, with a focus on financial period management.

## Features
- **Superfast performance**: Match 500,000 transactions in under 5 minutes
- **Database flexibility**: Works with MySQL, PostgreSQL, or SQLite

- Upload Multiple files into records
    Bank and System files (credits matches credits or debits matches debits) or 
    System and System Files (credit matches debits or vice versa)
- Map columns and apply transformations
- Match transactions using configurable panels
- **Custom transformations**: Define and chain custom transformation functions for data import
- **Matching relationship (One-To-One or One-To-Many)**: Support for both one-to-one and one-to-many transaction matching
- View matching progress and statistics in real time
- Admin dashboard with period actions (open, close, activate)
- Modular, responsive UI with reusable components
- Environment-based API configuration

# Customizing File Import and Match Type Settings

## Customizing File Import (Selecting Columns & Using Functions)


When importing files (System or Bank) via the API (`POST /files/system/import` or `POST /files/bank/import`), you can:

- **Select Columns:**
  - Map CSV columns to database fields using the import dialog. You can choose which columns to import and how they should be mapped. This is typically handled in the frontend and sent to the backend as part of the import request.

- **Apply Transformation Functions:**
  - You can apply one or more transformation functions to each column during import. Transformations allow you to clean, reformat, or filter data as it is imported.
  - **Chaining:** Multiple transformations can be chained together using a semicolon (`;`). For example: `trim;uppercase;skip_if:empty`.

#### Supported Transformation Functions

| Function                      | Description                                                      | Example Usage / Result                  |
|-------------------------------|------------------------------------------------------------------|-----------------------------------------|
| `convert_negative`            | Convert negative to positive                                     | `-100 → 100`                            |
| `abs`                         | Absolute value                                                   | `-100 → 100`                            |
| `substring:start,end`         | Extract substring                                                | `substring:0,5`                         |
| `left_of:chars`               | Extract text left of chars                                       | `90406597C1CLIFECOVER → 90406597`       |
| `skip_if:value`               | Skip row if value matches                                        | `skip_if:SKIP`                          |
| `skip_if:empty`               | Skip row if field is empty or blank                              | `skip_if:empty`                         |
| `uppercase`                   | Convert to uppercase                                             | `abc → ABC`                             |
| `trim`                        | Remove whitespace                                                | `" text " → "text"`                    |
| `change_value:value`          | Replace with constant value                                      | `change_value:NEW`                      |
| `replace_if:find=replace`     | Replace whole value if substring found                           | `replace_if:JAN=0C1`                    |
| `negate_if:value`             | Negate Amount if field value matches (applies to Amount column)  | `MovementType: negate_if:REVERSAL`      |

**Notes:**
- Chain transformations with semicolon: `skip_if:NEW; skip_if:TERMINATED; skip_if:empty; change_value:GRN;`
- `skip_if` conditions are always evaluated first to avoid unnecessary processing. Use `skip_if:empty` to skip rows where a field is blank or empty.
- `negate_if` can be on any field (e.g., MovementType, PolicyNo) but always negates the Amount. Example: if MovementType is "REVERSAL", negate the Amount.

**Example (frontend):**
- The import dialog lets you select which CSV columns map to which database fields.
- You can specify transformation functions for each column (e.g., `trim;uppercase;skip_if:empty`).

**Example (backend):**
- The backend receives a mapping and transformation config, applies the functions in order, and imports the data accordingly.

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
   - For advanced matching, the `parameters` object can include detailed debit and credit configuration:
     
     **Debit and Credit Parameter Structure:**
     ```json
     {
       "debit": {
         "source": ["System", "Bank"],           // List of sources to consider for debit side
         "movement_types": ["PAYMENT", "FEE"],   // List of movement types for debit
         "reference": "ref_field_name",           // Field name or value to use as reference
         "multi_period": false,                    // Allow matching across multiple periods
         "debit_credit": "debit"                  // Specify if this side is debit (usually "debit")
       },
       "credit": {
         "source": ["System", "Bank"],           // List of sources to consider for credit side
         "movement_types": ["RECEIPT"],           // List of movement types for credit
         "reference": "ref_field_name",           // Field name or value to use as reference
         "multi_period": false,                    // Allow matching across multiple periods
         "debit_credit": "credit"                 // Specify if this side is credit (usually "credit")
       },
       "threshold": 0.95,
       "customFunction": "normalizeReference"
     }
     ```
     
     **Parameter Field Descriptions:**
     - `debit.source` / `credit.source`: List of sources (e.g., `["System", "Bank"]`) to include for each side.
     - `debit.movement_types` / `credit.movement_types`: List of movement types (e.g., `["PAYMENT", "FEE"]`).
     - `debit.reference` / `credit.reference`: Field name or value to use as a reference for matching.
     - `debit.multi_period` / `credit.multi_period`: Boolean, whether to allow matching across multiple periods.
     - `debit.debit_credit` / `credit.debit_credit`: String, should be either `"debit"` or `"credit"` to indicate the side.
     - `threshold`: (optional) Numeric threshold for match confidence.
     - `customFunction`: (optional) Name of a custom function to apply during matching.
3. **Activate or deactivate** the match type as needed.

**Usage:**
- The matching engine will use the active `MatchTypeSetting` configurations to determine how transactions are matched.
- Matching can be performed as **one-to-one** (single debit to single credit) or **one-to-many** (single debit to multiple credits, or vice versa), depending on the match type configuration and business rules.



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
