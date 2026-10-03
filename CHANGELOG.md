# Changelog

All notable changes to this project will be documented in this file.

## [1.3.3] - 2026-10-03
### Fixed
- **Strict Item Mapping & Canonical PUT:** `syncTrustedIpsList` (steps 7c/7d) now filters and strictly maps list items to only the allowed properties `(ip, comment)`, stripping server metadata (`id`, `created_on`, `modified_on`) that the API could reject with `filters.api.invalid_json` (code 10026). The replace-all `PUT` sends a single canonical bare item-array body; the wrapped-`{"items":[...]}` shape fallback from 1.3.2 is no longer needed. Non-fatal semantics unchanged (#8).

## [1.3.2] - 2026-10-03
### Fixed
- **List PUT Payload Compatibility:** The replace-all `PUT` on `/accounts/{account_id}/rules/lists/{list_id}/items` now sends the wrapped `{"items": [...]}` payload first and automatically retries with the bare item-array payload (documented by the current OpenAPI spec and official SDKs) when the API rejects it with `filters.api.invalid_json` (code 10026). The sync is now compatible with every Cloudflare Lists API generation; failures remain non-fatal and logged.

## [1.3.1] - 2026-10-03
### Changed
- **List Entry Tags:** WAF List `my_trusted_ips` entries are now tagged with the raw WAN tag (`comment: "WAN1"` / `"WAN2"`, matching the UniFi username and DNS record comment) instead of the `UniFi WAN1` / `UniFi WAN2` prefix.
- **Legacy Cleanup:** Entries still tagged in the previous `UniFi <tag>` format for the same WAN are removed (migrated to the raw tag) on the next update; entries of other WANs and manually added IPs are untouched.

## [1.3.0] - 2026-10-03
### Added
- **WAF IP List Sync:** After a successful (or unchanged/verified) DNS update, the Worker synchronizes this WAN's IP into the account-level Cloudflare WAF IP List `my_trusted_ips`. Entries tagged for other WAN interfaces (`UniFi WAN2`, ...) and manually added IPs are preserved; this WAN's entry is appended/updated with `comment: "UniFi " + wanTag`.
- **Dynamic Account ID:** The Cloudflare Account ID is now extracted from the zone lookup response (`zone.result[0].account.id`) instead of being hardcoded, unlocking account-level APIs.
- **Non-blocking & Non-fatal:** List synchronization runs in the background via `ctx.waitUntil()` and is wrapped in `try/catch`; any list-sync failure is logged (`[IP List]` prefix) without affecting the DDNS response (`good`/`nochg` still returned when DNS succeeded).

### Changed
- **Observability Config:** Expanded `wrangler.toml` with full Workers Logs settings (`head_sampling_rate`, `invocation_logs`, `persist`), traces toggle and issue detection, so DDNS run logs (including the `[IP List]` steps) stream at full sampling.
- The list `PUT` sends a **bare JSON item array** (`[{ip, comment}]`) — the payload format actually required by the Cloudflare API (`PUT /accounts/{account_id}/rules/lists/{list_id}/items`), which replaces all items and returns an async `operation_id`.

## [1.2.0] - 2026-04-16
### Added
- **Verbose Logging:** Added `console.log` and `console.error` throughout the lifecycle for Cloudflare Log Stream debugging.
- **Inadyn Compatibility:** Updated return strings to include `911` (retry) and `badauth` (unauthorized) to match UniFi expectations.
- **Flexible Parameters:** Added support for `myip` and `host` parameter variants sent by different UniFi firmware versions.
- **Dual Identification:** The `Username` field now accepts either a DNS Comment OR a raw Record ID.

### Changed
- **Update Method:** Switched from `PUT` to `PATCH`. This ensures that updating the IP does not overwrite or reset existing Proxy (Orange Cloud) or TTL settings on the record.
- **Zone Lookup:** Improved domain parsing to better handle subdomains vs root domains during Zone ID identification.

## [1.1.0] - 2026-04-16
### Added
- Comment-based routing for Record identification.

## [1.0.0] - 2026-04-16
### Added
- Initial stateless worker release.
