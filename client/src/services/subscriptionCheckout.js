import api from "./api";
let scriptPromise;
export async function openSubscriptionCheckout(base, planId, { onOrder } = {}) {
  if (!window.Razorpay) {
    scriptPromise ??= new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      const timer = setTimeout(() => {
        script.remove();
        reject(new Error("Payment checkout took too long to load. Please try again."));
      }, 15000);
      script.onload = () => {
        clearTimeout(timer);
        window.Razorpay ? resolve() : reject(new Error("Checkout initialization failed"));
      };
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Unable to load payment checkout"));
      };
      document.body.appendChild(script);
    }).catch((error) => {
      scriptPromise = null;
      throw error;
    });
    await scriptPromise;
  }
  const { data } = await api.post(`${base}/subscription/checkout`, { planId }),
    order = data.order;
  if (
    !order?.orderId ||
    !order.keyId ||
    !Number.isSafeInteger(order.amount) ||
    order.amount <= 0 ||
    order.currency !== "INR"
  )
    throw new Error("Invalid checkout order");
  onOrder?.(order);
  return new Promise((resolve, reject) => {
    let failure,
      verifying = false;
    const checkout = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "Prakash SaaS",
      description: `${order.plan.name} subscription`,
      modal: {
        ondismiss: () => {
          if (!verifying)
            reject(
              failure ||
                new Error(
                  "Checkout closed. Refresh payment status before starting another payment.",
                ),
            );
        },
      },
      handler: async (payment) => {
        verifying = true;
        try {
          let result;
          try {
            result = await api.post(`${base}/subscription/verify`, payment);
          } catch (original) {
            try {
              result = await api.post(`${base}/subscription/reconcile`, { orderId: order.orderId });
            } catch {
              throw original;
            }
          }
          if (result.data.requiresReview)
            throw new Error("Payment was captured and needs support review before activation.");
          resolve(result.data);
        } catch (error) {
          reject(error);
        }
      },
    });
    checkout.on("payment.failed", (event) => {
      failure = new Error(
        event.error?.description || "Payment failed. Check your existing order before retrying.",
      );
    });
    checkout.open();
  });
}
