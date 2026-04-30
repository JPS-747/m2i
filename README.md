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
