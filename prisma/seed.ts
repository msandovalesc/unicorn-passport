/**
 * Seed data for local testing: reward tracks + tiers, sample employees (one admin),
 * past/current/upcoming events, and stamps that show different card states.
 * Safe to re-run: it wipes and recreates everything.
 */
import { PrismaClient, type EventType } from "@prisma/client";
import { randomBytes } from "node:crypto";

const db = new PrismaClient();
const token = () => randomBytes(24).toString("base64url");
const hours = (h: number) => new Date(Date.now() + h * 3600_000);

async function main() {
  await db.$transaction([
    db.reward.deleteMany(),
    db.stamp.deleteMany(),
    db.passRegistration.deleteMany(),
    db.pass.deleteMany(),
    db.event.deleteMany(),
    db.employee.deleteMany(),
    db.rewardTier.deleteMany(),
    db.rewardTrack.deleteMany(),
  ]);

  // Placeholder tiers: one reward on the 5th stamp and one on the 10th for both tracks.
  // Admins can change these (e.g. give Remote an earlier tier) from Admin → Tiers.
  const office = await db.rewardTrack.create({
    data: {
      slug: "office", name: "Office", description: "I mostly join events in person", sortOrder: 1,
      tiers: { create: [{ stampCount: 5, item: "Unicorn sticker pack + tote" }, { stampCount: 10, item: "Unosquare hoodie" }] },
    },
  });
  const remote = await db.rewardTrack.create({
    data: {
      slug: "remote", name: "Remote", description: "I mostly join events online", sortOrder: 2,
      tiers: { create: [{ stampCount: 5, item: "Unicorn sticker pack + mug (shipped)" }, { stampCount: 10, item: "Unosquare hoodie (shipped)" }] },
    },
  });

  const people = [
    { name: "Ana Admin", email: "ana.admin@unosquare.com", location: "Guadalajara", trackId: office.id, stamps: 3 },
    { name: "Bruno Rookie", email: "bruno.rookie@unosquare.com", location: "Guadalajara", trackId: office.id, stamps: 0 },
    { name: "Carla Regular", email: "carla.regular@unosquare.com", location: "Remote – Bogotá", trackId: remote.id, stamps: 4 },
    { name: "Diego Fivestar", email: "diego.fivestar@unosquare.com", location: "Portland", trackId: office.id, stamps: 5 },
    { name: "Elena Complete", email: "elena.complete@unosquare.com", location: "Remote – Belfast", trackId: remote.id, stamps: 10 },
    { name: "Fer Secondcard", email: "fer.secondcard@unosquare.com", location: "Guadalajara", trackId: office.id, stamps: 12 },
    { name: "Gabo Newbie", email: "gabo.newbie@unosquare.com", location: null, trackId: null, stamps: 0 },
  ];

  const employees = [];
  for (const p of people) {
    const e = await db.employee.create({
      data: {
        m365ObjectId: `dev-${p.email}`, name: p.name, email: p.email, location: p.location, trackId: p.trackId,
        passes: p.trackId ? { create: { platform: "web", serialNumber: token(), authToken: token(), cardToken: token() } } : undefined,
      },
    });
    employees.push({ ...e, stamps: p.stamps });
  }
  const admin = employees[0];

  // 12 past events so stamps can be spread across them, plus live and upcoming ones.
  const types: EventType[] = ["in_person", "virtual"];
  const pastNames = [
    "Unicorn Kickoff", "Tech Talk: Agentic AI", "Lunch & Learn: Cloud Costs", "unoTalks: Data Mesh", "Hackathon Demo Day",
    "Wellness Wednesday", "Day of the Dead Altar", "Posada", "Town Hall Q1", "Coffee with Leadership", "Code Retreat", "Trivia Night",
  ];
  const past = [];
  for (let i = 0; i < pastNames.length; i++) {
    const start = hours(-24 * (pastNames.length - i) * 7);
    past.push(
      await db.event.create({
        data: {
          name: pastNames[i], type: types[i % 2], startsAt: start, endsAt: new Date(+start + 2 * 3600_000),
          checkinOpensAt: new Date(+start - 1800_000), checkinClosesAt: new Date(+start + 3 * 3600_000),
          qrSecret: token(), createdById: admin.id, closedAt: new Date(+start + 3 * 3600_000),
        },
      }),
    );
  }
  await db.event.create({
    data: {
      name: "Live now: Friday Demo Jam", type: "in_person", description: "Guadalajara office, 3rd floor",
      startsAt: hours(-0.5), endsAt: hours(1.5), checkinOpensAt: hours(-1), checkinClosesAt: hours(3), qrSecret: token(), createdById: admin.id,
    },
  });
  await db.event.create({
    data: {
      name: "Live now: Remote Coffee Chat", type: "virtual", description: "Teams call",
      startsAt: hours(-0.25), endsAt: hours(0.75), checkinOpensAt: hours(-0.5), checkinClosesAt: hours(2), qrSecret: token(), createdById: admin.id,
    },
  });
  await db.event.create({
    data: {
      name: "Upcoming: Halloween Pixel Party", type: "in_person", startsAt: hours(24 * 7), endsAt: hours(24 * 7 + 3),
      checkinOpensAt: hours(24 * 7 - 0.5), checkinClosesAt: hours(24 * 7 + 4), qrSecret: token(), createdById: admin.id,
    },
  });

  // Stamps (and the rewards they would have unlocked) per employee.
  const allTiers = await db.rewardTier.findMany();
  for (const e of employees) {
    for (let i = 0; i < e.stamps; i++) {
      const ev = past[i % past.length];
      await db.stamp.create({ data: { employeeId: e.id, eventId: ev.id, method: i === 1 ? "manual" : "qr", addedById: i === 1 ? admin.id : null, note: i === 1 ? "Forgot phone" : null, createdAt: ev.startsAt } });
      const n = i + 1;
      const cardNumber = Math.ceil(n / 10);
      const onCard = ((n - 1) % 10) + 1;
      const tier = allTiers.find((t) => t.trackId === e.trackId && t.stampCount === onCard);
      if (tier) {
        await db.reward.create({
          data: {
            employeeId: e.id, cardNumber, tier: tier.stampCount, item: tier.item, unlockedAt: ev.startsAt,
            // Fer has already collected the first card's rewards; others are pending delivery.
            ...(e.email.startsWith("fer.") && cardNumber === 1 ? { redeemedAt: ev.endsAt, redeemedById: admin.id } : {}),
          },
        });
      }
    }
  }

  console.log(`Seeded ${employees.length} employees, ${past.length + 3} events, 2 reward tracks.`);
  console.log("Admin in dev login: ana.admin@unosquare.com (DEV_ADMIN_EMAILS)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
