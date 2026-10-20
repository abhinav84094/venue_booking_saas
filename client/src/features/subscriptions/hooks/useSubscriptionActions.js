import { useState } from "react";
import { openSubscriptionCheckout } from "../../../services/subscriptionCheckout";
import api from "../../../services/api";
export function useSubscriptionActions(base, reload, reloadVenue) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  async function checkout(planId) {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await openSubscriptionCheckout(base, planId, { onOrder: reload });
      setMessage("Payment verified by the server. Refreshing this hall’s subscription status.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      reload();
      reloadVenue();
    }
  }
  async function reconcile(orderId) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post(`${base}/subscription/reconcile`, { orderId });
      setMessage(
        data.requiresReview
          ? "This captured payment needs support review."
          : "Payment verified. Your subscription is up to date.",
      );
      reload();
      reloadVenue();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function recover() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`${base}/subscription/recover`);
      reload();
      setMessage("Checkout reconciled with the provider. Check the payment history below.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, message, checkout, reconcile, recover };
}
