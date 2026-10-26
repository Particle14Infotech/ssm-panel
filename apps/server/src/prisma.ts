import { PrismaClient } from "@prisma/client";

export class PrismaConnection {
  readonly client: PrismaClient;
  isConnected = false;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
    if (databaseUrl) {
      this.client = new PrismaClient({
        datasources: { db: { url: databaseUrl } },
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      });
    } else {
      this.client = new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      });
    }
  }

  async connect(): Promise<void> {
    try {
      if (process.env.DATABASE_URL || process.env.DATABASE_URL_TEST) {
        await this.client.$connect();
        this.isConnected = true;
      }
    } catch {
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.$disconnect().catch(() => undefined);
  }
}

export interface PrismaLike {
  isConnected: boolean;
  client: any;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
}
