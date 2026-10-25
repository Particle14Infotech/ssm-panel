const http = require("http");

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "localhost",
        port: 4000,
        path: `/api/v1${path}`,
        method,
        headers: {
          ...(data
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data),
              }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let resBody = "";
        res.on("data", (chunk) => (resBody += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(resBody);
          } catch {
            parsed = resBody;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log("============================================================");
  console.log("Q4 API Verification: Support Tickets, Notifications & Dashboard");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // 1. Register User A
  const userA = {
    name: `User A ${ts}`,
    username: `usera_${ts}`,
    email: `usera_${ts}@smm.dev`,
    password: "Password123!Secure",
  };
  const regARes = await request("POST", "/auth/register", userA);
  assert(regARes.status === 201 && regARes.data.token, "1. User A successfully registered");
  const tokenA = regARes.data.token;
  const userAId = regARes.data.user.id;

  // 2. Register User B
  const userB = {
    name: `User B ${ts}`,
    username: `userb_${ts}`,
    email: `userb_${ts}@smm.dev`,
    password: "Password123!Secure",
  };
  const regBRes = await request("POST", "/auth/register", userB);
  assert(regBRes.status === 201 && regBRes.data.token, "2. User B successfully registered");
  const tokenB = regBRes.data.token;
  const userBId = regBRes.data.user.id;

  // 3. User A profile check (GET /api/v1/users/me)
  const profileRes = await request("GET", "/users/me", null, tokenA);
  assert(profileRes.status === 200, "3. GET /users/me returned HTTP 200");
  assert(profileRes.data.email === userA.email, "4. Profile email matches registered user");
  assert(profileRes.data.balance === 0 || profileRes.data.wallet?.balance === 0, "5. Initial balance is 0.00 zero-state");

  // 4. User A opens new support ticket (POST /api/v1/tickets)
  const newTicket = {
    subject: `Order Delivery Delay Inquiry ${ts}`,
    message: `Hello support, my order seems to be taking longer than normal. Please assist. Ref: ${ts}`,
    priority: "HIGH",
    department: "ORDER_ISSUES",
  };
  const createTicketRes = await request("POST", "/tickets", newTicket, tokenA);
  assert(createTicketRes.status === 201 || createTicketRes.status === 200, "6. User A opens support ticket successfully");
  const ticketId = createTicketRes.data.ticketId || createTicketRes.data.ticket?.id || createTicketRes.data.id;
  assert(Boolean(ticketId), "7. Created ticket contains valid ID");
  const ticketObj = createTicketRes.data.ticket || createTicketRes.data;
  assert(ticketObj.subject === newTicket.subject, "8. Ticket subject recorded correctly");
  assert(ticketObj.status === "OPEN" || ticketObj.status === "PENDING", "9. Initial ticket status is OPEN/PENDING");

  // 5. User A lists their tickets (GET /api/v1/tickets)
  const listTicketsRes = await request("GET", "/tickets", null, tokenA);
  assert(listTicketsRes.status === 200, "10. GET /tickets returned HTTP 200");
  const foundTicket = (Array.isArray(listTicketsRes.data) ? listTicketsRes.data : listTicketsRes.data.tickets || []).find(
    (t) => t.id === ticketId
  );
  assert(foundTicket, "11. Created ticket appears in User A tickets list");

  // 6. User A retrieves ticket details (GET /api/v1/tickets/:id)
  const ticketDetailRes = await request("GET", `/tickets/${ticketId}`, null, tokenA);
  assert(ticketDetailRes.status === 200, "12. GET /tickets/:id returned HTTP 200");
  assert(ticketDetailRes.data.id === ticketId, "13. Ticket detail ID matches");

  // 7. User A posts reply to ticket (POST /api/v1/tickets/:id/reply)
  const replyMessage = `Following up with additional details: transaction ID is verified. Timestamp: ${Date.now()}`;
  const replyRes = await request("POST", `/tickets/${ticketId}/reply`, { message: replyMessage }, tokenA);
  assert(replyRes.status === 201 || replyRes.status === 200, "14. User A successfully posts reply to ticket");

  // 8. Cross-Tenant Isolation: User B attempts to access User A's ticket (GET /api/v1/tickets/:id)
  const crossTenantGetRes = await request("GET", `/tickets/${ticketId}`, null, tokenB);
  assert(
    crossTenantGetRes.status === 403 || crossTenantGetRes.status === 404,
    `15. Cross-Tenant Isolation: User B forbidden from viewing User A's ticket (Status: ${crossTenantGetRes.status})`
  );

  // 9. Cross-Tenant Isolation: User B attempts to reply to User A's ticket (POST /api/v1/tickets/:id/reply)
  const crossTenantReplyRes = await request(
    "POST",
    `/tickets/${ticketId}/reply`,
    { message: "Malicious cross-tenant injection attempt" },
    tokenB
  );
  assert(
    crossTenantReplyRes.status === 403 || crossTenantReplyRes.status === 404,
    `16. Cross-Tenant Isolation: User B forbidden from replying to User A's ticket (Status: ${crossTenantReplyRes.status})`
  );

  // 10. User A closes ticket (POST /api/v1/tickets/:id/close)
  const closeTicketRes = await request("POST", `/tickets/${ticketId}/close`, {}, tokenA);
  assert(closeTicketRes.status === 200 || closeTicketRes.status === 201, "17. User A closes support ticket");
  const closedDetailRes = await request("GET", `/tickets/${ticketId}`, null, tokenA);
  assert(
    closedDetailRes.data.status === "CLOSED" || closedDetailRes.data.status === "RESOLVED",
    `18. Ticket status updated to CLOSED (Observed: ${closedDetailRes.data.status})`
  );

  // 11. Role Guard: Customer attempts to access Admin all tickets endpoint (GET /api/v1/tickets/admin/all)
  const adminGuardRes = await request("GET", "/tickets/admin/all", null, tokenA);
  assert(
    adminGuardRes.status === 403,
    `19. Role Guard: Non-admin customer blocked from /tickets/admin/all (HTTP 403 Forbidden)`
  );

  // 12. Notification Feed (GET /api/v1/notifications)
  const notificationsRes = await request("GET", "/notifications", null, tokenA);
  assert(notificationsRes.status === 200, "20. GET /notifications returned HTTP 200");
  const notificationsList = Array.isArray(notificationsRes.data)
    ? notificationsRes.data
    : notificationsRes.data.notifications || [];
  assert(Array.isArray(notificationsList), "21. Notifications response is valid array");

  // 13. Customer Orders summary for dashboard (GET /api/v1/orders)
  const dashboardOrdersRes = await request("GET", "/orders", null, tokenA);
  assert(dashboardOrdersRes.status === 200, "22. GET /orders returned HTTP 200 for dashboard feed");
  const ordersList = Array.isArray(dashboardOrdersRes.data)
    ? dashboardOrdersRes.data
    : dashboardOrdersRes.data.orders || [];
  assert(ordersList.length === 0, "23. Zero-state dashboard orders count is exactly 0");

  console.log("\n============================================================");
  console.log(`Q4 API Verification Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("FATAL ERROR IN Q4 SUITE:", err);
  process.exit(1);
});
