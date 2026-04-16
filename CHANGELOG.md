# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-16

### Added
- Initial release of the stateless Cloudflare DDNS Worker.
- HTTP Basic Auth decoding to extract credentials passed by UniFi's `inadyn` client safely.
- Dynamic Cloudflare Zone ID lookup via API using the provided hostname.
- Cloudflare API `PUT` request implementation targeting specific DNS Record IDs for Multi-WAN support.
- `wrangler.toml` configuration for seamless GitHub-to-Cloudflare Workers deployment.
