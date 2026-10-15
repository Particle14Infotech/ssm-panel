import http from "http";

const TARGETS = [
  { host: "127.0.0.1", port: 4000, name: "API-Instance-1" },
  { host: "127.0.0.1", port: 4002, name: "API-Instance-2" },
];

let roundRobinIdx = 0;

const proxy = http.createServer((req, res) => {
  const target = TARGETS[roundRobinIdx % TARGETS.length];
  roundRobinIdx++;

  console.log(`[LoadBalancer:8080] Proxying ${req.method} ${req.url} -> ${target.name} (Port ${target.port})`);

  const proxyReq = http.request(
    {
      host: target.host,
      port: target.port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        "x-forwarded-host": req.headers.host,
        "x-forwarded-proto": "http",
        "x-routed-instance": target.name,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, {
        ...proxyRes.headers,
        "x-served-by": target.name,
      });
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (err) => {
    console.error(`[LoadBalancer Error] Target ${target.name} unreachable: ${err.message}`);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Bad Gateway", instance: target.name }));
  });

  req.pipe(proxyReq);
});

const PORT = 8088;
proxy.listen(PORT, () => {
  console.log(`🚀 SMM Dual-Instance Load Balancer active on http://127.0.0.1:${PORT}`);
});
