import { processSubscriptionWebhook } from "../services/subscriptions/webhookService.js";

export async function handleSubscriptionWebhook(req, res) {
  res.json(await processSubscriptionWebhook(req.body, req.get("x-razorpay-signature")));
}
