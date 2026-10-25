import { ProvidersService } from "./providers.service";

describe("Provider status-check health telemetry", () => {
  it("marks health degraded after three consecutive failed status checks", () => {
    const service = new ProvidersService({} as any, {} as any);
    const checkedAt = new Date();

    expect((service as any).getHealthTelemetry({
      consecutiveStatusFailures: 3,
      lastStatusCheckAt: checkedAt,
    })).toEqual({
      healthStatus: "DEGRADED",
      consecutiveStatusFailures: 3,
      lastStatusCheckAt: checkedAt.toISOString(),
    });
  });

  it("reports unknown when no recent status checks exist", () => {
    const service = new ProvidersService({} as any, {} as any);

    expect((service as any).getHealthTelemetry({
      consecutiveStatusFailures: 0,
      lastStatusCheckAt: null,
    })).toEqual({
      healthStatus: "UNKNOWN",
      consecutiveStatusFailures: 0,
      lastStatusCheckAt: null,
    });
  });

  it("returns healthy after a successful recent check and unknown for stale checks", () => {
    const service = new ProvidersService({} as any, {} as any);
    const checkedAt = new Date();

    expect((service as any).getHealthTelemetry({
      consecutiveStatusFailures: 0,
      lastStatusCheckAt: checkedAt,
    }).healthStatus).toBe("HEALTHY");
    expect((service as any).getHealthTelemetry({
      consecutiveStatusFailures: 3,
      lastStatusCheckAt: new Date(Date.now() - 31 * 60 * 1000),
    }).healthStatus).toBe("UNKNOWN");
  });
});
