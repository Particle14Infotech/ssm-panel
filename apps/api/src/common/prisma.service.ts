import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const dbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
    super(
      dbUrl
        ? {
            datasources: {
              db: {
                url: dbUrl,
              },
            },
            log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
          }
        : {
            log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
          }
    );
  }

  public isConnected = false;

  async onModuleInit() {
    if (process.env.SANDBOX_MODE === "true" || process.env.BENCHMARK_MODE === "true") {
      this.isConnected = false;
      return;
    }
    try {
      if (process.env.DATABASE_URL || process.env.DATABASE_URL_TEST) {
        await this.$connect();
        this.isConnected = true;
      }
    } catch (e: any) {
      this.isConnected = false;
      console.warn("⚠️ Database connection skipped in sandbox mode:", e?.message);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {}
  }
}
