# UniFi to Cloudflare Dual-WAN DDNS (Stateless & Log-Enabled)

A secure, stateless Cloudflare Worker designed to update multiple A records for a single domain across different UniFi WAN interfaces. This version is optimized for strict `inadyn` compatibility and includes verbose logging for easy troubleshooting.

## Why This Project?
UniFi gateways use `inadyn` for DDNS. Native Cloudflare support in UniFi often fails with Dual-WAN because it can't distinguish between which record belongs to which WAN. 

This Worker solves this by using **Cloudflare DNS Comments** (or Record IDs) as unique anchors. It identifies the target record based on the "Username" you provide in the UniFi GUI.

## Key Features
- **Stateless Architecture:** No environment variables or secrets are stored in the Cloudflare Dashboard.
- **Enhanced Compatibility:** Returns specific codes (`good`, `nochg`, `badauth`, `911`) required by UniFi to show correct status.
- **Verbose Logging:** Real-time feedback via the Cloudflare Workers Log stream.
- **Flexible Identification:** Use either a human-readable **DNS Comment** (e.g., `WAN1`) or a specific **Record ID** in the Username field.
- **Safe Updates:** Uses the HTTP `PATCH` method to update only the IP, preserving your Proxy (CDN) and TTL settings.
- **WAF IP List Sync:** Additionally keeps an account-level Cloudflare WAF IP List (`my_trusted_ips`) in sync with each WAN's IP, so `ip.src in $my_trusted_ips` firewall/WAF rules stay up to date. This happens in the background (`ctx.waitUntil`) and never breaks the DDNS response.

## Prerequisites
1. **Cloudflare API Token:** Requires `Zone:Zone:Read` and `Zone:DNS:Edit` permissions. **Optional but recommended** for WAF List Sync: `Account Filter Lists Edit` (the dashboard shows it under **Account > Lists**) — without it, DNS updates still work but the list sync logs a non-fatal warning.
2. **WAF IP List (optional):** Create an account-level **IP List** named `my_trusted_ips` (**Cloudflare Dashboard > Account > Manage Account > Lists > Create List**, type *IP*). The Worker synchronizes it automatically; if you skip this, the sync only logs a warning.
3. **DNS Record Setup:**
   - Create two `A` records for your domain (e.g., `example.com`).
   - Add a comment to the first record: `WAN1`.
   - Add a comment to the second record: `WAN2`.

## Installation
1. Create a private GitHub repository.
2. Add `index.js` and `wrangler.toml` to the root.
3. In Cloudflare, go to **Workers & Pages > Create > Workers > Connect to Git**.
4. Deploy the Worker and note your `*.workers.dev` URL.

## UniFi Configuration

Navigate to **Settings > Internet** in the UniFi Network Application:

### WAN 1
- **Service:** `Custom`
- **Hostname:** `example.com`
- **Username:** `WAN1` (Must match the comment in Cloudflare)
- **Password:** `<Cloudflare API Token>`
- **Server:** `your-worker-subdomain.workers.dev/update?ip=%i&hostname=%h`
  > ⚠️ **IMPORTANT:** Do not include `https://` in the Server field.

### WAN 2
- **Service:** `Custom`
- **Hostname:** `example.com`
- **Username:** `WAN2`
- **Password:** `<Cloudflare API Token>`
- **Server:** `your-worker-subdomain.workers.dev/update?ip=%i&hostname=%h`

## WAF IP List Sync (`my_trusted_ips`)

Every time a WAN interface's DNS record is updated (or verified as unchanged), the Worker also synchronizes that WAN's IP into the account-level Cloudflare WAF IP List `my_trusted_ips` — the Account ID is taken dynamically from the zone lookup response, so nothing is hardcoded.

How entries are reconciled (per WAN interface):
- The current list contents are fetched via the [List Items API](https://developers.cloudflare.com/api/resources/rules/subresources/lists/subresources/items/methods/list/), then the list is overwritten via `PUT` with a **bare JSON array** of items (the format the Cloudflare API expects).
- Any entry whose comment is **not** this WAN's tag (`wanTag`) is kept untouched — manually added IPs and entries for other WANs such as `WAN2`. Entries carrying the legacy `UniFi <tag>` prefix for this WAN (written by versions before 1.3.1) are cleaned up/migrated on the next update.
- This WAN's previous entry (`comment` equal to `wanTag`, e.g. `WAN1`) — if any — is replaced by the new IP tagged `comment: "WAN1"`.
- With both WANs updating, the list ends up containing all WAN IPs, each tagged with its interface:

  ```json
  [
    { "ip": "203.0.113.10", "comment": "WAN1" },
    { "ip": "198.51.100.77", "comment": "WAN2" },
    { "ip": "10.0.0.99", "comment": "office static ip" }
  ]
  ```

Use the list in a WAF custom rule / firewall rule with an expression like:

```cel
ip.src in $my_trusted_ips
```

Behavior guarantees:
- The Account ID is derived from the zone lookup (`zone.result[0].account.id`) — no secrets or IDs hardcoded.
- Synchronization runs **non-blocking** via `ctx.waitUntil()` and is wrapped in `try/catch`: the UniFi gateway still receives `good`/`nochg` as long as the DNS update succeeded, even if the list sync, the list lookup, or the network fails. Failures are logged with the `[IP List]` prefix.
- If a list named `my_trusted_ips` does not exist, the Worker logs a warning and skips the sync (create the list to enable it).

## How to Debug (Logging)
If your records aren't updating:
1. Log into your Cloudflare Dashboard.
2. Go to **Workers & Pages** > Select your Worker.
3. Click the **Logs** tab > **Begin log stream**.
4. Trigger an update in UniFi (e.g., by changing a character in the password and saving).
5. The Worker will output step-by-step logs showing Zone lookups, API responses and the `[IP List]` synchronization steps.
