import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const received = { source: 'web-gateway', level: 'INFO', eventType: 'REQUEST_RECEIVED', message: 'Checkout request received', durationMs: 0 };
const authenticated = { source: 'auth-service', level: 'INFO', eventType: 'AUTHENTICATION_PASSED', message: 'User authenticated', durationMs: 12 };

// Fixed scenarios and timestamps make the fixture repeatable. No random values or clock reads.
export const failureScenarios = [
  {
    requestId: 'req-demo-1003', scenario: 'expired-token', probableCause: 'TOKEN_EXPIRING',
    steps: [received,
      { source: 'auth-service', level: 'INFO', eventType: 'TOKEN_LOOKUP', message: 'Looking up the supplied authentication token', durationMs: 8 },
      { source: 'auth-service', level: 'WARN', eventType: 'TOKEN_EXPIRING', message: 'Authentication token is at its expiry boundary', durationMs: 10 },
      { source: 'auth-service', level: 'ERROR', eventType: 'TOKEN_EXPIRED', message: 'Authentication token has expired', statusCode: 401, durationMs: 13 },
      { source: 'web-gateway', level: 'ERROR', eventType: 'REQUEST_REJECTED', message: 'Checkout request rejected because authentication failed', statusCode: 401, durationMs: 18 }],
  },
  {
    requestId: 'req-demo-1006', scenario: 'missing-cart-item', probableCause: 'CART_ITEM_UNAVAILABLE',
    steps: [received, authenticated,
      { source: 'checkout-service', level: 'WARN', eventType: 'CART_ITEM_UNAVAILABLE', message: 'A cart item is no longer available in the catalog', durationMs: 20 },
      { source: 'checkout-service', level: 'ERROR', eventType: 'CART_VALIDATION_FAILED', message: 'Cart validation failed because an item is unavailable', statusCode: 409, durationMs: 25 },
      { source: 'web-gateway', level: 'ERROR', eventType: 'CHECKOUT_REJECTED', message: 'Checkout rejected; refresh the cart before retrying', statusCode: 409, durationMs: 40 }],
  },
  {
    requestId: 'req-demo-1009', scenario: 'payment-timeout', probableCause: 'PAYMENT_PROVIDER_SLOW',
    steps: [received, authenticated,
      { source: 'payment-service', level: 'WARN', eventType: 'PAYMENT_PROVIDER_SLOW', message: 'Payment provider response exceeded the expected latency', durationMs: 2000 },
      { source: 'payment-service', level: 'ERROR', eventType: 'PAYMENT_TIMEOUT', message: 'Payment provider timed out before authorization completed', statusCode: 504, durationMs: 3000 },
      { source: 'checkout-service', level: 'ERROR', eventType: 'CHECKOUT_FAILED', message: 'Checkout failed after a payment authorization timeout', statusCode: 504, durationMs: 3100 }],
  },
  {
    requestId: 'req-demo-1012', scenario: 'invalid-postal-code', probableCause: 'POSTAL_CODE_UNSUPPORTED',
    steps: [received, authenticated,
      { source: 'checkout-service', level: 'WARN', eventType: 'POSTAL_CODE_UNSUPPORTED', message: 'Shipping postal code is outside the supported delivery region', durationMs: 18 },
      { source: 'checkout-service', level: 'ERROR', eventType: 'ADDRESS_VALIDATION_FAILED', message: 'Shipping address failed delivery-region validation', statusCode: 422, durationMs: 24 },
      { source: 'web-gateway', level: 'ERROR', eventType: 'CHECKOUT_REJECTED', message: 'Checkout rejected; a supported shipping address is required', statusCode: 422, durationMs: 38 }],
  },
  {
    requestId: 'req-demo-1015', scenario: 'database-connection-failure', probableCause: 'DB_POOL_EXHAUSTED',
    steps: [received, authenticated,
      { source: 'checkout-service', level: 'WARN', eventType: 'DB_POOL_EXHAUSTED', message: 'No database connection is immediately available in the pool', durationMs: 1000 },
      { source: 'checkout-service', level: 'ERROR', eventType: 'DB_CONNECTION_FAILED', message: 'Database connection acquisition timed out', statusCode: 503, durationMs: 2000 },
      { source: 'web-gateway', level: 'ERROR', eventType: 'CHECKOUT_FAILED', message: 'Checkout could not persist the order before its deadline', statusCode: 503, durationMs: 2100 }],
  },
  {
    requestId: 'req-demo-1018', scenario: 'payment-declined', probableCause: 'PAYMENT_RISK_REVIEW',
    steps: [received, authenticated,
      { source: 'payment-service', level: 'WARN', eventType: 'PAYMENT_RISK_REVIEW', message: 'Payment provider flagged the authorization for risk review', durationMs: 100 },
      { source: 'payment-service', level: 'ERROR', eventType: 'PAYMENT_DECLINED', message: 'Payment provider declined the authorization', statusCode: 402, durationMs: 180 },
      { source: 'checkout-service', level: 'ERROR', eventType: 'CHECKOUT_FAILED', message: 'Checkout failed because payment was declined', statusCode: 402, durationMs: 220 }],
  },
];

export function buildDemoEvents() {
  const events = [];
  const startTime = Date.parse('2026-09-20T14:00:00Z');
  const successfulSteps = [received, authenticated,
    { source: 'checkout-service', level: 'INFO', eventType: 'CART_VALIDATED', message: 'Cart items and shipping address validated', durationMs: 22 },
    { source: 'payment-service', level: 'INFO', eventType: 'PAYMENT_AUTHORIZED', message: 'Payment authorization succeeded', statusCode: 200, durationMs: 95 },
    { source: 'checkout-service', level: 'INFO', eventType: 'CHECKOUT_COMPLETED', message: 'Order saved and checkout completed', statusCode: 201, durationMs: 145 }];

  for (let requestIndex = 0; requestIndex < 20; requestIndex++) {
    const requestId = `req-demo-${1001 + requestIndex}`;
    let scenario = 'successful-checkout';
    let steps = successfulSteps;
    for (const failure of failureScenarios) {
      if (failure.requestId === requestId) {
        scenario = failure.scenario;
        steps = failure.steps;
        break;
      }
    }
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      events.push({
        occurredAt: new Date(startTime + requestIndex * 60000 + stepIndex * 1000).toISOString(),
        source: step.source,
        level: step.level,
        eventType: step.eventType,
        message: step.message,
        requestId,
        statusCode: step.statusCode ?? null,
        durationMs: step.durationMs,
        details: JSON.stringify({ synthetic: true, scenario, route: '/checkout', step: stepIndex + 1 }),
      });
    }
  }
  return events;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = JSON.stringify(buildDemoEvents(), null, 2) + '\n';
  await writeFile(new URL('./events.json', import.meta.url), json);
  await writeFile(new URL('../frontend/public/demo-events.json', import.meta.url), json);
  console.log('Wrote 100 events to data/events.json and frontend/public/demo-events.json.');
}
