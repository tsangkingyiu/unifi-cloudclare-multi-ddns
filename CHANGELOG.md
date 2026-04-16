# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-04-16
### Added
- **Comment-based Routing:** Replaced the need for manual Record IDs with Cloudflare DNS Comments.
- **Safety Logic:** Added a check to prevent overwriting the wrong WAN record by matching the UniFi username to the Cloudflare record comment.
- **No-Change Detection:** The Worker now detects if the IP is already correct and returns `nochg` to save API calls.

## [1.0.0] - 2026-04-16
### Added
- Initial stateless worker release.
- Dynamic Zone ID lookup and Basic Auth decoding.
