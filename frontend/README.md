# React Admin Dashboard (Frontend)

This is a React + Vite admin dashboard for the FastAPI financial period backend.

## Features

- Overview cards for latest period metrics
- Table of latest 12 periods
- Actions panel for:
  - Close period
  - Activate period
  - Open period
- Responsive admin layout with modular CSS stylesheets

## Environment

Copy environment file and set API URL if needed.

```powershell
Copy-Item .env.example .env
```

Default value:

- `VITE_API_BASE_URL=http://127.0.0.1:8000`

## Run

```powershell
npm install
npm run dev
```

Open: `http://127.0.0.1:5173`

## Build

```powershell
npm run build
npm run preview
```
