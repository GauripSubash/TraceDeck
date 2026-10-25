# Observer answer key

Keep this file away from participants until their session ends.
Source: `../data/events.json`. Each trace has five strictly ordered events.
Score both event type and service; earliest warning does not prove root cause.

- T1 / req-demo-1003: `TOKEN_EXPIRING`, `auth-service`, 14:02:02 UTC.
- T2 / req-demo-1006: `CART_ITEM_UNAVAILABLE`, `checkout-service`, 14:05:02 UTC.
- T3 / req-demo-1009: `PAYMENT_PROVIDER_SLOW`, `payment-service`, 14:08:02 UTC.
- T4 / req-demo-1012: `POSTAL_CODE_UNSUPPORTED`, `checkout-service`, 14:11:02 UTC.
- T5 / req-demo-1015: `DB_POOL_EXHAUSTED`, `checkout-service`, 14:14:02 UTC.
- T6 / req-demo-1018: `PAYMENT_RISK_REVIEW`, `payment-service`, 14:17:02 UTC.

All timestamps are on September 20, 2026. Each task's setup window begins two
seconds before the warning above and ends two seconds after it, inclusive.
These are expected answers, not participant observations or benchmark results.
