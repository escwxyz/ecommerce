# Effect HTTP API and SDK Foundation

## Canonical API roots

Task 4.1 introduces the canonical Effect HTTP API roots in `@ecommerce/api`:

- `adminHttpApi`
- `storefrontHttpApi`

The admin root owns backend contracts for admin/dashboard operations. The
storefront root owns public customer-facing contracts and is the future source
for both browser HTTP and Cloudflare Service Binding SDK transports.

## Contribution rule

Modules and trusted plugins contribute `HttpApiGroup` contracts through
`EffectHttpApiGroupContribution` values. Each contribution must carry both the
group contract and its handler `Layer`; later assembly tasks compose those
groups into the canonical roots and serve them from the Cloudflare Worker.

The API contract package owns these roots. Server packages provide runtime
Layers and transport only; they do not own reusable API schemas or commerce
handlers.
