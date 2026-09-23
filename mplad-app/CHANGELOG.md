# MPLAD App - Recent Fixes & Updates Log

## 1. Project Execution Instructions
- The project is a Next.js application. The development server can be started using `npm run dev`.
- Additional data pipeline and generation scripts can be run via npm (`npm run seed`, `npm run db-load`, `npm run detect`, etc.) or via the provided `Makefile` (`make seed`, `make db-load`, `make eval`).

## 2. Fixed Schema Mismatch in Next.js Homepage (`app/page.js`)
- **Issue:** The homepage was throwing a `TypeError: Cannot read properties of undefined (reading 'count')` because it was attempting to query tables from an older version of the database schema (e.g., `WorkProposal`, `EntitlementYear`, `Constituency`, `ImplementingAgency`).
- **Fix:** Rewrote the database fetching and aggregation logic in `app/page.js` to use the current models defined in `schema.prisma` (`Work`, `FundFlow`, `Mp`, `Agency`). The dashboard statistics and metrics now correctly aggregate data based on the updated schema structure without crashing.

## 3. Fixed Prisma Type Conversion Error in Database
- **Issue:** The application threw a `PrismaClientKnownRequestError` (`Error converting field "constituency" of expected non-nullable type "String", found incompatible value of "0"`). SQLite allows dynamic typing and had stored integer `0` in the `constituency` column, but Prisma strictly expected a String as defined in `schema.prisma`.
- **Fix:** Executed a Python script to connect to the SQLite database (`data/app.db`) and cast all non-text values in the `mps` table's `constituency` column to `TEXT`. This resolved the Prisma strict-typing runtime crash.
