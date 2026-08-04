# Effect Config and Redacted Conventions

All backend configuration is decoded through Effect `Config`. Runtime-neutral
packages declare typed configuration values; application and test composition
roots provide the source through `ConfigProvider` Layers.

## Configuration contracts

- Use typed constructors such as `Config.port`, `Config.url`, and
  `Config.schema` instead of reading `process.env`, Worker bindings, or plain
  objects inside business code.
- Use `Config.all` for related values and `Config.nested` for an explicit
  namespace. Environment naming remains uppercase snake case at deployment
  boundaries.
- Validate configuration before constructing dependent Layers. Missing,
  malformed, or out-of-range required values fail startup through Effect's
  typed configuration error channel.
- Defaults apply only to genuinely optional operational settings. A default
  must not convert malformed data into a valid value or hide a missing secret.
- Platform adapters translate Worker bindings, Node environment values, test
  maps, or another source into a `ConfigProvider`; runtime-neutral code does not
  select the platform provider.

## Secrets

- Declare credentials, tokens, signing material, passwords, private keys, and
  connection strings with `Config.redacted` or `secretConfig`.
- Keep values as `Redacted<string>` across configuration and service
  construction. Call `Redacted.value` only at the smallest trusted adapter call
  that requires the raw secret.
- Never put unwrapped secrets in errors, logs, spans, metrics, schema issues,
  Layer identifiers, URLs returned to clients, or snapshots.
- `Redacted` reduces accidental disclosure; it is not encryption or a secrets
  store. Cloudflare secrets remain the first production source.

## Tests

Place tests under `__tests__/` and inject a `ConfigProvider` Layer. Cover valid
decoding, missing required keys, malformed values, default behavior, and secret
redaction. Test fixtures use non-production credentials and must verify that
formatted or JSON output does not contain the raw value.
