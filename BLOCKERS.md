# Active Blockers Log

This document records any blockers, missing secrets, or ambiguous external dependencies encountered during the overnight master run, along with the safe defaults adopted to continue without interruption.

| ID | Phase | Description | Safe Default Adopted | Required From User For Full Live Launch | Status |
|:---|:---|:---|:---|:---|:---|
| BLK-001 | Phase 5/7 | Production Razorpay Gateway Secret Keys | Fallback to SimulatedPaymentProvider (`PAYMENT_PROVIDER=simulated` + `ALLOW_SIMULATED_PAYMENTS=true`) | Live Razorpay Key ID & Key Secret | Non-blocking (Simulated Mode Online) |
| BLK-002 | Phase 7 | Live Upstream SMM Provider API Tokens | Mock/Simulated SMM worker protocol with automatic status advancement | Real SMM Provider API Keys in Admin > Providers | Non-blocking (Worker engine active) |
