import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== START PRODUCTION FORENSICS ===');

  try {
    // 1. Check Orders
    const orders = await prisma.order.findMany({
      include: {
        service: { select: { id: true, name: true, platform: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log(`[ORDERS_COUNT]: ${orders.length}`);
    for (const o of orders) {
      console.log(`ORDER: id=${o.id} userId=${o.userId} target=${o.target} qty=${o.quantity} charge=${o.charge} status=${o.status} provOrderId=${o.providerOrderId} created=${o.createdAt.toISOString()}`);
    }

    // 2. Check Recent Ledgers
    const ledgers = await prisma.ledgerEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log(`[LEDGERS_COUNT]: ${ledgers.length}`);
    for (const l of ledgers) {
      console.log(`LEDGER: id=${l.id} type=${l.type} amount=${l.amount} orderId=${l.orderId}`);
    }

    // 3. Check Outbox
    const outbox = await prisma.outboxEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log(`[OUTBOX_COUNT]: ${outbox.length}`);
    for (const ob of outbox) {
      console.log(`OUTBOX: id=${ob.id} eventType=${ob.eventType} status=${ob.status} attempts=${ob.attempts}`);
    }

    // 4. Check Tickets
    const tickets = await prisma.ticket.findMany({
      include: { messages: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log(`[TICKETS_COUNT]: ${tickets.length}`);
    for (const t of tickets) {
      console.log(`TICKET: id=${t.id} userId=${t.userId} subject="${t.subject}" status=${t.status} msgs=${t.messages.length}`);
    }

    // 5. Check Providers
    const providers = await prisma.provider.findMany();
    console.log(`[PROVIDERS_COUNT]: ${providers.length}`);
    for (const p of providers) {
      console.log(`PROVIDER: id=${p.id} name=${p.name} active=${p.active} balance=${p.balance} currency=${p.currency} url=${p.apiUrl}`);
    }
  } catch (err) {
    console.error('Forensics error:', err.message);
  } finally {
    await prisma.$disconnect();
    console.log('=== END PRODUCTION FORENSICS ===');
  }
}

main();
