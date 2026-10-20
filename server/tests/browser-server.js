import { fileURLToPath } from "node:url";
import { mock } from "node:test";
import { Writable } from "node:stream";
// Disposable local server used only by the explicitly requested automated UI tests.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import User from "../models/User.js";
import { initializeIndexes } from "../models/venueModels.js";
import { createApp, attachErrorHandlers } from "../app.js";
import { attachClient } from "../services/seoService.js";
import { syncEnvironmentPlans } from "../services/subscriptionPlanService.js";
import { getRazorpay } from "../config/razorpay.js";
import { getCloudinary } from "../config/cloudinary.js";
import { OAuth2Client } from "google-auth-library";
import GoogleAuthorization from "../models/GoogleAuthorization.js";
process.env.NODE_ENV = "test";
process.env.VENUE_PLAN_3_MONTHS_PRICE = "500";
process.env.VENUE_PLAN_1_YEAR_PRICE = "1500";
process.env.VENUE_SUBSCRIPTION_MODE = "off";
process.env.VENUE_SERVE_CLIENT = "true";
process.env.VENUE_JWT_SECRET = "disposable-browser-test-jwt-secret-32-characters";
process.env.VENUE_GOOGLE_CLIENT_ID = "disposable-browser-google-client";
process.env.VENUE_CORS_ALLOWED_ORIGINS = "http://127.0.0.1:5600";
process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_ID = "rzp_test_browser";
process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_SECRET = "disposable-browser-gateway-secret";
process.env.VENUE_CLOUDINARY_CLOUD_NAME = "disposable-browser-images";
process.env.VENUE_CLOUDINARY_API_KEY = "disposable-browser-image-key";
process.env.VENUE_CLOUDINARY_API_SECRET = "disposable-browser-image-secret";
delete process.env.PUBLIC_VENUE_DOMAIN;
// Google UI responses are simulated only in this disposable browser process.
// authentication.test.js separately exercises the real SDK with signed tokens.
mock.method(OAuth2Client.prototype, "verifyIdToken", async ({ idToken }) => {
  const input = JSON.parse(idToken);
  if (input.testOnly !== "venue-browser-fixture") throw new Error("Invalid fixture");
  return {
    getPayload: () => ({
      sub: input.sub,
      email: input.email,
      name: "Google Browser Owner",
      nonce: input.nonce,
      email_verified: true,
      iss: "https://accounts.google.com",
      aud: process.env.VENUE_GOOGLE_CLIENT_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  };
});
// Only this disposable test process replaces the remote SDK. Production verification,
// identity checks and transactional activation still run for every browser checkout.
// The image SDK is also stubbed here, so browser uploads never contact a real account.
mock.method(
  getCloudinary().uploader,
  "upload_stream",
  (options, callback) =>
    new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
      final(done) {
        callback(null, {
          secure_url: "https://images.example.test/hall-upload.png",
          public_id: `${options.folder}/disposable-browser-image`,
        });
        done();
      },
    }),
);
const remoteOrders = new Map();
let orderSequence = 0;
const gateway = getRazorpay();
mock.method(gateway.orders, "create", async (options) => {
  const order = { ...options, id: `order_Browser${++orderSequence}`, status: "created" };
  remoteOrders.set(order.id, order);
  return order;
});
mock.method(gateway.orders, "fetch", async (id) => remoteOrders.get(id));
mock.method(gateway.orders, "all", async ({ receipt }) => {
  const items = [...remoteOrders.values()].filter((order) => order.receipt === receipt);
  return { items, count: items.length };
});
mock.method(gateway.payments, "fetch", async (id) => {
  const order = remoteOrders.get(id.replace(/^pay_/, "order_"));
  if (!order) throw new Error("Unknown disposable test payment");
  order.status = "paid";
  return {
    id,
    order_id: order.id,
    status: "captured",
    amount: order.amount,
    currency: order.currency,
    amount_refunded: 0,
  };
});
const repl = await MongoMemoryReplSet.create({
  binary: {
    downloadDir: fileURLToPath(
      new URL("../node_modules/.cache/mongodb-memory-server/", import.meta.url),
    ),
  },
  replSet: { count: 1 },
});
await mongoose.connect(repl.getUri(), { dbName: "venue_disposable_browser_tests" });
await User.init();
await GoogleAuthorization.init();
await initializeIndexes();
await syncEnvironmentPlans();
await User.create({
  name: "Browser Test Owner",
  email: "browser-owner@example.test",
  password: "BrowserTestOnly123!",
  emailVerified: true,
});
await User.create({
  name: "Browser Test Admin",
  email: "browser-admin@example.test",
  password: "BrowserTestOnly123!",
  emailVerified: true,
  role: "platform_admin",
});
await User.create({
  name: "Appearance Test Owner",
  email: "appearance-owner@example.test",
  password: "BrowserTestOnly123!",
  emailVerified: true,
});
const app = createApp();
await attachClient(app);
attachErrorHandlers(app);
const server = app.listen(5600, "127.0.0.1", () =>
  console.log("Disposable venue browser-test server is ready"),
);
const close = () =>
  server.close(async () => {
    await mongoose.disconnect();
    await repl.stop();
    process.exit(0);
  });
process.once("SIGTERM", close);
process.once("SIGINT", close);
