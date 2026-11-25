import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';

export type PortfolioDb = NeonHttpDatabase<typeof schema>;

let cachedDb: PortfolioDb | null = null;
let cachedUrl: string | undefined;

export function getDb(): PortfolioDb | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  if (cachedDb && cachedUrl === databaseUrl) {
    return cachedDb;
  }

  const sql = neon(databaseUrl);
  cachedDb = drizzle(sql, { schema });
  cachedUrl = databaseUrl;
  return cachedDb;
}
