# MPLADS Desktop App

## Quick Start (Development)

```bash
cd mplad-desktop
npm install
npm start
```

This will open the Electron window. The app will start the Next.js server on port 3000 and load it.

**Prerequisites:**
1. Build the Next.js app first: `cd ../mplad-app && npm run build --webpack`
2. Have Node.js installed

## Build Windows Installer

```bash
npm run dist
```

Output: `dist/MPLADS Portal Setup 1.0.0.exe`

## Default Officer Login (for testing)
- Username: `officer1`
- Password: `officer123`
- Constituency: CONST-101
