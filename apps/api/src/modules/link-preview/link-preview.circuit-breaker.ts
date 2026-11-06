export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class UpstreamCircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureTimestamps: number[] = [];
  private openUntil = 0;
  private readonly failureThreshold = 5;
  private readonly windowMs = 30000; // 30s failure window
  private readonly cooldownMs = 60000; // 60s cooldown

  constructor(public readonly upstreamName: string) {}

  getState(): CircuitState {
    const now = Date.now();
    if (this.state === "OPEN" && now >= this.openUntil) {
      this.state = "HALF_OPEN";
    }
    return this.state;
  }

  isCallPermitted(): boolean {
    const currentState = this.getState();
    return currentState === "CLOSED" || currentState === "HALF_OPEN";
  }

  recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      this.failureTimestamps = [];
    }
  }

  recordFailure(): void {
    const now = Date.now();
    if (this.state === "HALF_OPEN") {
      // Immediate trip back to OPEN on test probe failure
      this.state = "OPEN";
      this.openUntil = now + this.cooldownMs;
      return;
    }

    // Filter to failures within recent window
    this.failureTimestamps = this.failureTimestamps.filter((t) => now - t <= this.windowMs);
    this.failureTimestamps.push(now);

    if (this.failureTimestamps.length >= this.failureThreshold) {
      this.state = "OPEN";
      this.openUntil = now + this.cooldownMs;
    }
  }

  forceOpen(durationMs = 60000): void {
    this.state = "OPEN";
    this.openUntil = Date.now() + durationMs;
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureTimestamps = [];
    this.openUntil = 0;
  }
}

