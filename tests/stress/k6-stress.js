import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    breaking_point_stress: {
      executor: "ramping-arrival-rate",
      startRate: 200,
      timeUnit: "1s",
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { duration: "10s", target: 500 },   // ramp to 500 req/s
        { duration: "10s", target: 1500 },  // ramp to 1500 req/s
        { duration: "15s", target: 3500 },  // ramp to 3500 req/s
        { duration: "10s", target: 6000 },  // push beyond nominal capacity
        { duration: "5s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"], // observe when system passes failure boundary
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:4000/api/v1";

export default function () {
  const res = http.get(`${BASE_URL}/services`, {
    tags: { endpoint: "stress_services" },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
  });
}
