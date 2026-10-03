# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-10-03
### Added
- **WAF IP List Sync:** After a successful (or unchanged/verified) DNS update, the Worker synchronizes this WAN's IP into the account-level Cloudflare WAF IP List `my_trusted_ips`. Entries tagged for other WAN interfaces (`UniFi WAN2`, ...) and manually added IPs are preserved; this WAN's entry is appended/updated with `comment: "UniFi " + wanTag`.
- **Dynamic Account ID:** The Cloudflare Account ID is now extracted from the zone lookup response (`zone.result[0].account.id`) instead of being hardcoded, unlocking account-level APIs.
- **Non-blocking & Non-fatal:** List synchronization runs in the background via `ctx.waitUntil()` and is wrapped in `try/catch`; any list-sync failure is logged (`[IP List]` prefix) without affecting the DDNS response (`good`/`nochg` still returned when DNS succeeded).

### Changed
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
