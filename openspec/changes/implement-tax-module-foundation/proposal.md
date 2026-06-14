## Why

Tax calculation must remain independent from pricing and promotion while consuming store/region policy inputs. This change follows `tax-module-map`.

## What Changes

- Implement a tax module for tax regions, tax rates, tax categories, tax provider configuration, calculation policy, and tax line outputs.
- Keep region policy ownership outside tax.
- Contribute tax API/admin metadata and tests.

## Capabilities

### New Capabilities

- `tax-module-foundation`: Implements the first tax contracts from `tax-module-map`.

### Modified Capabilities

- None.

## Impact

- Affected areas: `packages/modules/tax`, shared database schema assembly, `packages/api`, `apps/web`, and tests.
- Map traceability: derived from `tax-module-map`.
