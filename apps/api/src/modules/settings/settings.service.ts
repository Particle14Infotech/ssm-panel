import { Injectable } from "@nestjs/common";

@Injectable()
export class SettingsService {
  private settings: Record<string, any> = {
    platformName: "SMM PANEL",
    currency: "INR",
    maintenanceMode: false,
    autoRefillEnabled: true,
    minDepositAmount: 100,
    maxDepositAmount: 200000,
    supportEmail: process.env.SUPPORT_EMAIL || "support@smmpanel.internal",
    telegramBot: "@smm_panel_ops_bot",
    resellerDiscountPct: 15,
    dripFeedEnabled: process.env.DRIPFEED_ENABLED !== undefined ? process.env.DRIPFEED_ENABLED === "true" : true,
    dripFeedMinRuns: process.env.DRIPFEED_MIN_RUNS ? parseInt(process.env.DRIPFEED_MIN_RUNS, 10) : 2,
    dripFeedMaxRuns: process.env.DRIPFEED_MAX_RUNS ? parseInt(process.env.DRIPFEED_MAX_RUNS, 10) : 100,
    dripFeedMinInterval: process.env.DRIPFEED_MIN_INTERVAL ? parseInt(process.env.DRIPFEED_MIN_INTERVAL, 10) : 5,
    dripFeedMaxInterval: process.env.DRIPFEED_MAX_INTERVAL ? parseInt(process.env.DRIPFEED_MAX_INTERVAL, 10) : 1440,
  };

  getSettings() {
    return this.settings;
  }

  updateSettings(updates: Record<string, any>) {
    this.settings = { ...this.settings, ...updates };
    return { success: true, settings: this.settings };
  }
}
