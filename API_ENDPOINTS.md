# API Endpoints Documentation

## Overview

The capacity planner uses intelligent save functionality that automatically calls the appropriate API endpoints based on which data has been modified:

### 1. Main Table (Top Table) API

**Endpoint:** `POST http://localhost:3001/saveMainTableData`

**Payload Structure:**

```json
{
  "id": 12345,
  "transformationUnitId": 679,
  "amount": 100,
  "month": 8,
  "year": 2025
}
```

**Description:** Saves capacity forecast data for the main forecasting table.

### 2. CTB Table (Bottom Table) API

**Endpoint:** `POST http://localhost:3001/saveCTBTableData`

**Payload Structure:**

```json
{
  "id": 12346,
  "transformationUnitId": 679,
  "bcId": 29,
  "amount": 50,
  "month": 8,
  "year": 2025,
  "transformationUnitForecastDetailId": 740
}
```

**Description:** Saves CTB (Capacity Requested by) data for specific business units.

## Smart Save Functionality

### Intelligent Endpoint Selection:

The application automatically determines which endpoint(s) to call based on data changes:

- **Main Table Changes Only** → Calls only `saveMainTableData` endpoint
- **CTB Table Changes Only** → Calls only `saveCTBTableData` endpoint
- **Both Tables Changed** → Calls both endpoints simultaneously
- **No Changes** → Shows warning message, no API calls made

### Single Save Button:

- **Save Button** - Intelligently saves only the modified data
- Button is disabled when no changes are detected in either table
- User feedback shows exactly which tables are being saved

### Benefits:

✅ **Optimized Performance** - Only modified data is sent  
✅ **Smart API Calls** - Only necessary endpoints are called  
✅ **Single Click Experience** - One button handles all scenarios  
✅ **Clear Feedback** - Users know exactly what's being saved  
✅ **Network Efficiency** - Minimal API calls reduce server load

## Change Tracking

The system tracks changes at the cell level using:

- `changedMainTableCells` Set for main table changes
- `changedCTBCells` Set for CTB table changes

Only changed cells are sent to the appropriate API endpoint(s).
