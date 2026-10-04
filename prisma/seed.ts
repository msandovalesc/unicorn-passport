/**
 * Seed data for local testing:
 * - reward tracks + tiers
 * - 7 named test users with known card states (shown in the dev login)
 * - ~45 generated employees with realistic attendance, so the admin dashboard has data
 * - 20 past events over 12 weeks, 2 live events and 1 upcoming event
 * Safe to re-run: it wipes and recreates everything.
 */
import { PrismaClient, type EventType } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { tiersReachedBetween } from "../src/lib/progress";

const db = new PrismaClient();
const token = () => randomBytes(24).toString("base64url");
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const at = (ms: number) => new Date(now + ms);

// Deterministic randomness so the dashboard looks the same after every reseed.
let seed = 20261004;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const FIRST = ["Andrea", "Luis", "María", "Jorge", "Sofía", "Carlos", "Valeria", "Miguel", "Daniela", "José", "Paula", "Ricardo", "Camila", "Héctor", "Lucía", "Emilio", "Ximena", "Pablo", "Renata", "Óscar", "Sara", "Iván", "Fernanda", "Tomás", "Natalia", "Sean", "Aoife", "Ciarán", "Megan", "Ryan"];
const LAST = ["García", "Hernández", "López", "Martínez", "Rodríguez", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Ortiz", "Gutiérrez", "Chávez", "Ramos", "Murphy", "Kelly", "O'Brien"];
const OFFICES = ["Guadalajara", "Guadalajara", "Guadalajara", "Mexico City", "Portland", "Belfast"];
const REMOTE = ["Remote – Bogotá", "Remote – Monterrey", "Remote – Lima", "Remote – Mérida", "Remote – Dublin"];

function slug(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();
}

async function main() {
  await db.$transaction([
    db.rateLimit.deleteMany(),
    db.reward.deleteMany(),
    db.stamp.deleteMany(),
    db.passRegistration.deleteMany(),
    db.pass.deleteMany(),
    db.event.deleteMany(),
    db.employee.deleteMany(),
    db.rewardTier.deleteMany(),
    db.rewardTrack.deleteMany(),
  ]);

  // Placeholder tiers: a reward on the 5th stamp and one on the 10th for both tracks.
  const office = await db.rewardTrack.create({
    data: {
      slug: "office", name: "Office", description: "I mostly join events in person", sortOrder: 1,
      tiers: { create: [{ stampCount: 5, item: "Unicorn sticker pack + tote" }, { stampCount: 10, item: "Unosquare hoodie" }] },
    },
    include: { tiers: true },
  });
  const remote = await db.rewardTrack.create({
    data: {
      slug: "remote", name: "Remote", description: "I mostly join events online", sortOrder: 2,
      tiers: { create: [{ stampCount: 5, item: "Unicorn sticker pack + mug (shipped)" }, { stampCount: 10, item: "Unosquare hoodie (shipped)" }] },
    },
    include: { tiers: true },
  });
  const tiersByTrack = new Map([
    [office.id, office.tiers],
    [remote.id, remote.tiers],
  ]);

  // ── Named test users (dev login). Their stamp counts are fixed so card states are predictable.
  const named = [
    { name: "Ana Admin", email: "ana.admin@unosquare.com", location: "Guadalajara", trackId: office.id, stamps: 3 },
    { name: "Bruno Rookie", email: "bruno.rookie@unosquare.com", location: "Guadalajara", trackId: office.id, stamps: 0 },
    { name: "Carla Regular", email: "carla.regular@unosquare.com", location: "Remote – Bogotá", trackId: remote.id, stamps: 4 },
    { name: "Diego Fivestar", email: "diego.fivestar@unosquare.com", location: "Portland", trackId: office.id, stamps: 5 },
    { name: "Elena Complete", email: "elena.complete@unosquare.com", location: "Remote – Belfast", trackId: remote.id, stamps: 10 },
    { name: "Fer Secondcard", email: "fer.secondcard@unosquare.com", location: "Guadalajara", trackId: office.id, stamps: 12 },
    { name: "Gabo Newbie", email: "gabo.newbie@unosquare.com", location: null, trackId: null, stamps: 0 },
  ];

  type Person = { id: string; trackId: string | null; remote: boolean; fixed?: number; propensity: number; joinedAt: Date };
  const people: Person[] = [];

  for (const p of named) {
    const joinedAt = at(-90 * DAY);
    const e = await db.employee.create({
      data: {
        m365ObjectId: `dev-${p.email}`, name: p.name, email: p.email, location: p.location, trackId: p.trackId, createdAt: joinedAt,
        passes: p.trackId ? { create: { platform: "web", serialNumber: token(), authToken: token(), cardToken: token() } } : undefined,
      },
    });
    people.push({ id: e.id, trackId: p.trackId, remote: p.trackId === remote.id, fixed: p.stamps, propensity: 0, joinedAt });
  }
  const adminId = people[0].id;

  // ── Generated employees, enrolling gradually over the 12 weeks.
  const usedEmails = new Set<string>();
  for (let i = 0; i < 45; i++) {
    const first = FIRST[Math.floor(rand() * FIRST.length)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    let email = `${slug(first)}.${slug(last)}@unosquare.com`;
    for (let n = 2; usedEmails.has(email); n++) email = `${slug(first)}.${slug(last)}${n}@unosquare.com`;
    usedEmails.add(email);
    const isRemote = rand() < 0.4;
    const joinedAt = at(-Math.floor(rand() * 80 + 4) * DAY);
    const e = await db.employee.create({
      data: {
        m365ObjectId: `gen-${i}`, name: `${first} ${last}`, email,
        location: isRemote ? REMOTE[Math.floor(rand() * REMOTE.length)] : OFFICES[Math.floor(rand() * OFFICES.length)],
        trackId: isRemote ? remote.id : office.id, createdAt: joinedAt,
        passes: {
          create: [
            { platform: "web", serialNumber: token(), authToken: token(), cardToken: token() },
            // Some already have wallet passes so the dashboard shows wallet adoption.
            ...(rand() < 0.55 ? [{ platform: (rand() < 0.75 ? "apple" : "google") as "apple" | "google", serialNumber: token(), authToken: token(), cardToken: token() }] : []),
          ],
        },
      },
    });
    people.push({ id: e.id, trackId: e.trackId, remote: isRemote, propensity: 0.15 + rand() * 0.6, joinedAt });
  }

  // ── Events: 20 past events over the last 12 weeks.
  const pastEvents: Array<{ name: string; type: EventType; daysAgo: number }> = [
    ["Unicorn Kickoff", "in_person", 83], ["Tech Talk: Agentic AI", "virtual", 78], ["Lunch & Learn: Cloud Costs", "in_person", 76],
    ["unoTalks: Data Mesh", "virtual", 70], ["Hackathon Demo Day", "in_person", 63], ["Wellness Wednesday", "virtual", 57],
    ["Guadalajara Taco Friday", "in_person", 55], ["Town Hall Q3", "virtual", 49], ["Coffee with Leadership", "virtual", 43],
    ["Code Retreat", "in_person", 41], ["Trivia Night", "virtual", 35], ["Lightning Talks", "in_person", 33],
    ["Security Awareness Live", "virtual", 28], ["Mexican Independence Fiesta", "in_person", 19], ["unoTalks: Platform Teams", "virtual", 16],
    ["Book Club: The Phoenix Project", "virtual", 13], ["Volunteering Day", "in_person", 11], ["AI Pair-Programming Clinic", "virtual", 7],
    ["Bowling Night", "in_person", 5], ["Fireside Chat: Nearshore 2027", "virtual", 2],
  ].map(([name, type, daysAgo]) => ({ name: name as string, type: type as EventType, daysAgo: daysAgo as number }));

  const past = [];
  for (const ev of pastEvents) {
    const start = at(-ev.daysAgo * DAY + 17 * HOUR - (now % DAY));
    past.push(
      await db.event.create({
        data: {
          name: ev.name, type: ev.type, startsAt: start, endsAt: new Date(+start + 2 * HOUR),
          description: ev.type === "virtual" ? "Teams call" : "Guadalajara office",
          checkinOpensAt: new Date(+start - 0.5 * HOUR), checkinClosesAt: new Date(+start + 3 * HOUR),
          qrSecret: token(), createdById: adminId, closedAt: new Date(+start + 3 * HOUR),
        },
      }),
    );
  }

  await db.event.create({
    data: {
      name: "Live now: Friday Demo Jam", type: "in_person", description: "Guadalajara office, 3rd floor",
      startsAt: at(-0.5 * HOUR), endsAt: at(1.5 * HOUR), checkinOpensAt: at(-1 * HOUR), checkinClosesAt: at(6 * HOUR), qrSecret: token(), createdById: adminId,
    },
  });
  await db.event.create({
    data: {
      name: "Live now: Remote Coffee Chat", type: "virtual", description: "Teams call",
      startsAt: at(-0.25 * HOUR), endsAt: at(0.75 * HOUR), checkinOpensAt: at(-0.5 * HOUR), checkinClosesAt: at(6 * HOUR), qrSecret: token(), createdById: adminId,
    },
  });
  await db.event.create({
    data: {
      name: "Halloween Pixel Party", type: "in_person", description: "Guadalajara office rooftop",
      startsAt: at(7 * DAY), endsAt: at(7 * DAY + 3 * HOUR), checkinOpensAt: at(7 * DAY - 0.5 * HOUR), checkinClosesAt: at(7 * DAY + 4 * HOUR),
      qrSecret: token(), createdById: adminId,
    },
  });

  // ── Stamps (chronological per person) + the rewards they unlock.
  for (const p of people) {
    const attended = p.fixed !== undefined
      ? past.slice(past.length - p.fixed) // named users: their most recent N events
      : past.filter((ev) => {
          if (ev.startsAt < p.joinedAt) return false;
          const fit = (ev.type === "virtual") === p.remote ? 1.25 : 0.7;
          return rand() < p.propensity * fit;
        });

    let count = 0;
    for (const ev of attended) {
      const manual = p.fixed === undefined && rand() < 0.05;
      const createdAt = new Date(+ev.startsAt + Math.floor(rand() * 90) * 60_000);
      await db.stamp.create({
        data: {
          employeeId: p.id, eventId: ev.id, createdAt,
          method: manual ? "manual" : ev.type === "virtual" && rand() < 0.2 ? "code" : "qr",
          addedById: manual ? adminId : null, note: manual ? "Forgot phone" : null,
        },
      });
      const reached = tiersReachedBetween(count, count + 1, tiersByTrack.get(p.trackId ?? "") ?? []);
      count++;
      for (const t of reached) {
        // Older rewards have mostly been handed out; Diego and Elena keep theirs pending for testing.
        const keepPending = p.id === people[3].id || p.id === people[4].id;
        const handedOut = p.id === people[5].id ? t.cardNumber === 1 : !keepPending && now - +createdAt > 14 * DAY && rand() < 0.7;
        await db.reward.create({
          data: {
            employeeId: p.id, cardNumber: t.cardNumber, tier: t.stampCount, item: t.item, unlockedAt: createdAt,
            ...(handedOut ? { redeemedAt: new Date(+createdAt + Math.floor(rand() * 7 + 1) * DAY), redeemedById: adminId } : {}),
          },
        });
      }
    }
  }

  const [employees, stamps, rewards] = await Promise.all([db.employee.count(), db.stamp.count(), db.reward.count()]);
  console.log(`Seeded ${employees} employees, ${past.length + 3} events, ${stamps} stamps, ${rewards} rewards, 2 reward tracks.`);
  console.log("Dev login admin: ana.admin@unosquare.com (DEV_ADMIN_EMAILS)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
