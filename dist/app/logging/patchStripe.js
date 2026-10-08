"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*
  Global Stripe instrumentation patch
  - Wraps commonly used Stripe SDK resource methods to emit OpenTelemetry spans
  - Lives in logging folder and loads once during app bootstrap
  - No changes needed in services/controllers — calls remain the same
*/
const api_1 = require("@opentelemetry/api");
const stripe_1 = require("../../config/stripe");
// Lightweight sanitizer to avoid leaking secrets in span attributes
const sanitize = (value) => {
    try {
        return JSON.parse(JSON.stringify(value, (key, val) => {
            const k = String(key).toLowerCase();
            if (!key)
                return val;
            if (k.includes('secret') || k.includes('client_secret') || k.includes('api_key') || k.includes('password')) {
                return '[redacted]';
            }
            return val;
        }));
    }
    catch {
        return undefined;
    }
};
const tracer = api_1.trace.getTracer('app');
function wrapMethod(resource, methodName, resourceLabel) {
    if (!resource || typeof resource[methodName] !== 'function')
        return;
    const original = resource[methodName].bind(resource);
    resource[methodName] = function patchedStripeMethod(...args) {
        const opName = `Stripe.${resourceLabel}.${methodName}`;
        return tracer.startActiveSpan(opName, span => {
            const start = Date.now();
            try {
                // Attach minimal request attributes (sanitized)
                try {
                    span.setAttribute('stripe.resource', resourceLabel);
                }
                catch { }
                try {
                    span.setAttribute('stripe.method', methodName);
                }
                catch { }
                try {
                    span.setAttribute('stripe.request', sanitize(args));
                }
                catch { }
                const out = original(...args);
                if (out && typeof out.then === 'function') {
                    return out
                        .then(res => {
                        try {
                            span.setAttribute('stripe.ms', Date.now() - start);
                        }
                        catch { }
                        try {
                            if (res && res.id)
                                span.setAttribute('stripe.result.id', String(res.id));
                        }
                        catch { }
                        try {
                            span.setAttribute('stripe.status', 'ok');
                        }
                        catch { }
                        try {
                            span.end();
                        }
                        catch { }
                        return res;
                    })
                        .catch(err => {
                        try {
                            span.recordException(err);
                        }
                        catch { }
                        try {
                            span.setAttribute('stripe.ms', Date.now() - start);
                        }
                        catch { }
                        try {
                            span.setAttribute('stripe.status', 'error');
                        }
                        catch { }
                        try {
                            span.end();
                        }
                        catch { }
                        throw err;
                    });
                }
                // Non-promise path (rare for Stripe SDK)
                try {
                    span.setAttribute('stripe.ms', Date.now() - start);
                }
                catch { }
                try {
                    span.setAttribute('stripe.status', 'ok');
                }
                catch { }
                try {
                    span.end();
                }
                catch { }
                return out;
            }
            catch (err) {
                try {
                    span.recordException(err);
                }
                catch { }
                try {
                    span.end();
                }
                catch { }
                throw err;
            }
        });
    };
}
try {
    // Avoid double-patching in dev hot-reload
    if (!stripe_1.stripe.__otel_stripe_patched) {
        // Accounts
        wrapMethod(stripe_1.stripe.accounts, 'create', 'accounts');
        wrapMethod(stripe_1.stripe.accounts, 'retrieve', 'accounts');
        wrapMethod(stripe_1.stripe.accounts, 'del', 'accounts');
        wrapMethod(stripe_1.stripe.accounts, 'list', 'accounts');
        // Account Links
        wrapMethod(stripe_1.stripe.accountLinks, 'create', 'accountLinks');
        // Payment Intents
        wrapMethod(stripe_1.stripe.paymentIntents, 'create', 'paymentIntents');
        wrapMethod(stripe_1.stripe.paymentIntents, 'retrieve', 'paymentIntents');
        wrapMethod(stripe_1.stripe.paymentIntents, 'capture', 'paymentIntents');
        wrapMethod(stripe_1.stripe.paymentIntents, 'cancel', 'paymentIntents');
        // Transfers
        wrapMethod(stripe_1.stripe.transfers, 'create', 'transfers');
        // Refunds
        wrapMethod(stripe_1.stripe.refunds, 'create', 'refunds');
        // Webhook endpoints (diagnostics)
        wrapMethod(stripe_1.stripe.webhookEndpoints, 'list', 'webhookEndpoints');
        // Webhooks.constructEvent (signature verification)
        if (stripe_1.stripe.webhooks && typeof stripe_1.stripe.webhooks.constructEvent === 'function') {
            const originalConstruct = stripe_1.stripe.webhooks.constructEvent.bind(stripe_1.stripe.webhooks);
            stripe_1.stripe.webhooks.constructEvent = function patchedConstructEvent(...args) {
                return tracer.startActiveSpan('Stripe.webhooks.constructEvent', span => {
                    try {
                        const evt = originalConstruct(...args);
                        try {
                            span.setAttribute('stripe.status', 'ok');
                        }
                        catch { }
                        try {
                            span.end();
                        }
                        catch { }
                        return evt;
                    }
                    catch (err) {
                        try {
                            span.recordException(err);
                        }
                        catch { }
                        try {
                            span.setAttribute('stripe.status', 'error');
                        }
                        catch { }
                        try {
                            span.end();
                        }
                        catch { }
                        throw err;
                    }
                });
            };
        }
        stripe_1.stripe.__otel_stripe_patched = true;
    }
}
catch { }
//# sourceMappingURL=patchStripe.js.map