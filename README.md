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

## Prerequisites
1. **Cloudflare API Token:** Requires `Zone:Zone:Read` and `Zone:DNS:Edit` permissions.
2. **DNS Record Setup:**
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

## How to Debug (Logging)
If your records aren't updating:
1. Log into your Cloudflare Dashboard.
2. Go to **Workers & Pages** > Select your Worker.
3. Click the **Logs** tab > **Begin log stream**.
4. Trigger an update in UniFi (e.g., by changing a character in the password and saving).
5. The Worker will output step-by-step logs showing Zone lookups and API responses.
