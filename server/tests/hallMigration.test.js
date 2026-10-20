import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { migrateHallSubscriptions } from "../scripts/migrate-hall-subscriptions.js";
import { assertHallMigrationComplete } from "../config/db.js";

let repl, db;
const id = () => new mongoose.Types.ObjectId();
before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri(), { dbName: "venue_hall_migration_tests", autoIndex: false });
  db = mongoose.connection.db;
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});

test("migration dry run preserves data; apply scopes shared customers and never fans venue payment into paid halls", async () => {
  const venueId = id(),
    ownerId = id(),
    first = id(),
    second = id(),
    customerId = id(),
    orphanId = id();
  const booking1 = id(),
    booking2 = id(),
    legacySubscription = id(),
    legacyPayment = id();
  await db.collection("venues").insertOne({ _id: venueId, ownerId });
  await db.collection("halls").insertMany([
    { _id: first, venueId },
    { _id: second, venueId },
  ]);
  await db.collection("subscriptions").createIndex({ venueId: 1 }, { unique: true });
  await db.collection("subscriptions").insertOne({
    _id: legacySubscription,
    venueId,
    status: "active",
    activePaymentId: legacyPayment,
  });
  await db
    .collection("subscriptionpayments")
    .insertOne({ _id: legacyPayment, venueId, status: "paid", razorpayPaymentId: "pay_legacy" });
  await db.collection("customers").createIndex({ venueId: 1, phone: 1 }, { unique: true });
  await db.collection("customers").insertMany([
    { _id: customerId, venueId, phone: "9876543210", name: "Stored Customer" },
    { _id: orphanId, venueId, phone: "9876543211" },
  ]);
  await db.collection("bookings").insertMany([
    { _id: booking1, venueId, hallId: first, customerId },
    { _id: booking2, venueId, hallId: second, customerId },
  ]);
  await db.collection("payments").insertOne({ venueId, bookingId: booking2, amount: 50000 });
  await assert.rejects(assertHallMigrationComplete(db), /require migration/);
  const preview = await migrateHallSubscriptions(db);
  assert.equal(preview.apply, false);
  assert.equal(preview.unassignedCustomers, 1);
  assert.equal(await db.collection("subscriptions").countDocuments(), 1);
  assert.equal(await db.collection("customers").countDocuments(), 2);
  await migrateHallSubscriptions(db, { apply: true });
  await assertHallMigrationComplete(db);
  const hallSubscriptions = await db
    .collection("subscriptions")
    .find({ hallId: { $exists: true } })
    .toArray();
  assert.equal(hallSubscriptions.length, 2);
  assert.ok(
    hallSubscriptions.every(
      (sub) => sub.status === "pending" && !sub.activePaymentId && sub.ownerId.equals(ownerId),
    ),
  );
  assert.equal(
    (await db.collection("subscriptions").findOne({ _id: legacySubscription })).status,
    "active",
  );
  assert.equal(await db.collection("subscriptionpayments").countDocuments(), 1);
  const one = await db.collection("bookings").findOne({ _id: booking1 });
  const two = await db.collection("bookings").findOne({ _id: booking2 });
  assert.equal(one.customerId.equals(two.customerId), false);
  for (const booking of [one, two]) {
    const customer = await db.collection("customers").findOne({ _id: booking.customerId });
    assert.ok(customer.hallId.equals(booking.hallId));
    assert.equal(customer.name, "Stored Customer");
  }
  assert.ok(
    (await db.collection("payments").findOne({ bookingId: booking2 })).hallId.equals(second),
  );
  assert.equal((await db.collection("customers").findOne({ _id: orphanId })).hallId, undefined);
  await migrateHallSubscriptions(db, { apply: true });
  assert.equal(await db.collection("subscriptions").countDocuments(), 3);
  assert.equal(await db.collection("customers").countDocuments(), 3);
});

test("migration resumes a partially scoped customer without losing another hall's booking", async () => {
  const venueId = id(),
    ownerId = id(),
    first = id(),
    second = id(),
    customerId = id();
  await db.collection("venues").insertOne({ _id: venueId, ownerId });
  await db.collection("halls").insertMany([
    { _id: first, venueId },
    { _id: second, venueId },
  ]);
  await db
    .collection("customers")
    .insertOne({ _id: customerId, venueId, hallId: first, phone: "9876543212" });
  const booking = { venueId, hallId: second, customerId };
  await db.collection("bookings").insertOne(booking);
  await migrateHallSubscriptions(db, { apply: true });
  const updated = await db.collection("bookings").findOne({ _id: booking._id });
  assert.equal(updated.customerId.equals(customerId), false);
  assert.ok(
    (await db.collection("customers").findOne({ _id: updated.customerId })).hallId.equals(second),
  );
});
