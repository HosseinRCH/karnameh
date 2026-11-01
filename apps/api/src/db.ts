import { PrismaClient } from '@prisma/client';

// The PrismaClient constructor does not open a connection; queries do.
// This keeps the HTTP server (and /health) startable without a database.
export const prisma = new PrismaClient();
