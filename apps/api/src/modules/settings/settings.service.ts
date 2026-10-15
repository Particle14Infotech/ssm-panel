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
    supportEmail: "support@smmarchitecture.com",
    telegramBot: "@smm_panel_ops_bot",
    resellerDiscountPct: 15,
  };

  getSettings() {
    return this.settings;
  }

  updateSettings(updates: Record<string, any>) {
    this.settings = { ...this.settings, ...updates };
    return { success: true, settings: this.settings };
  }
}
