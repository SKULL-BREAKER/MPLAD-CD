import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Resolve the absolute path to demo.db relative to THIS file (lib/db.js → ../demo.db)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '..', 'demo.db');

// Warn loudly if DB file is missing so the error is obvious in logs
if (!fs.existsSync(DB_PATH)) {
  console.error(`[DB] WARNING: demo.db not found at ${DB_PATH}`);
} else {
  console.log(`[DB] Using database: ${DB_PATH}`);
}

const globalForPrisma = globalThis;

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: { url: `file:${DB_PATH}` },
    },
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'],
  });
};

/** @type {PrismaClient} */
const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
