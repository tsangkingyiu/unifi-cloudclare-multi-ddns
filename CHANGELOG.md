# Changelog

All notable changes to this project will be documented in this file.

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
