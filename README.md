# UniFi to Cloudflare Dual-WAN DDNS (Tag-Based)

A stateless, zero-configuration Cloudflare Worker designed to solve the Dual-WAN DDNS problem on UniFi Gateways (UDM-Pro, UCG-Ultra, etc.). This version uses **Cloudflare DNS Comments** instead of Record IDs to target specific records, making setup much simpler.

## Features
* **No Record IDs:** Uses human-readable tags (e.g., `WAN1`, `WAN2`) stored in Cloudflare's DNS record comments.
* **Stateless:** No need to configure environment variables in the Cloudflare dashboard.
* **Secure:** Uses HTTP Basic Auth headers to pass credentials, keeping your API tokens out of URL logs.
* **Dual-WAN Ready:** Perfectly syncs two separate A records for the same domain across two different physical WAN interfaces.

## Prerequisites
1. **Cloudflare API Token:** Create a token with `Zone:Zone:Read` and `Zone:DNS:Edit` permissions.
2. **Setup DNS Records:** - Manually create two A records for your domain (e.g., `example.com`) in Cloudflare.
   - Click **"Edit"** on the first record and add the comment `WAN1`.
   - Click **"Edit"** on the second record and add the comment `WAN2`.

## Installation
1. Create a private GitHub repository.
2. Add `index.js` (the worker code) and `wrangler.toml`.
3. In Cloudflare, go to **Workers & Pages** > **Create application** > **Connect to Git**.
4. Deploy the worker and copy your `*.workers.dev` URL.

## UniFi Configuration

Go to **Settings > Internet** in your UniFi Network Application and configure both WANs:

| Field | WAN 1 Setting | WAN 2 Setting |
| :--- | :--- | :--- |
| **Service** | `Custom` | `Custom` |
| **Hostname** | `example.com` | `example.com` |
| **Username** | `WAN1` | `WAN2` |
| **Password** | `YOUR_CF_API_TOKEN` | `YOUR_CF_API_TOKEN` |
| **Server** | `your-worker.workers.dev/update?ip=%i&hostname=%h` | `your-worker.workers.dev/update?ip=%i&hostname=%h` |

> ⚠️ **Note:** Do **not** include `https://` or `%u/%p` in the Server field. UniFi sends the Username and Password securely via headers automatically when they are omitted from the URL.

## Troubleshooting
- **bad_tag**: The Username in UniFi does not match the Comment field in Cloudflare.
- **bad_zone**: Your API token cannot find the domain. Check your token permissions.
