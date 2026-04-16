# UniFi to Cloudflare Dual-WAN DDNS (Stateless Worker)

A zero-configuration, secure Cloudflare Worker designed to update multiple A records for the same domain across different WAN interfaces. 

## Why This Exists
UniFi's built-in DDNS client (`inadyn`) is designed for a 1-to-1 mapping of hostname to IP. In a Dual-WAN environment, if you try to update the same domain from both WAN1 and WAN2, they will overwrite each other. 

This Worker uses **Cloudflare DNS Comments** as unique identifiers. By tagging your DNS records in Cloudflare with a comment (like `WAN1` and `WAN2`), the Worker ensures that WAN1 only ever updates the WAN1 record, and WAN2 only ever updates the WAN2 record.

## Features
* **No Record IDs Needed:** Uses human-readable DNS comments (e.g., "WAN1") to identify records.
* **Zero Worker Config:** No environment variables or secrets are required in the Cloudflare Dashboard.
* **Stateless & Secure:** API keys are transmitted via HTTP Basic Auth headers, keeping them out of URL logs.
* **Dynamic Zone Lookup:** Automatically finds your Cloudflare Zone ID based on the hostname provided by UniFi.

## Prerequisites
1. **Cloudflare API Token:** Requires `Zone:Zone:Read` and `Zone:DNS:Edit` permissions.
2. **DNS Record Setup:** * Create two `A` records for your domain (e.g., `example.com`).
   * Add a comment to the first record: `WAN1`.
   * Add a comment to the second record: `WAN2`.

## Installation
1. Create a private GitHub repository.
2. Add `index.js` and `wrangler.toml` to the root.
3. In Cloudflare, go to **Workers & Pages > Create > Workers > Connect to Git**.
4. Deploy the Worker and note your `*.workers.dev` URL.

## UniFi Configuration

Go to **Settings > Internet** in your UniFi Network Application and configure each WAN as follows:

### WAN 1
* **Service:** `Custom`
* **Hostname:** `example.com`
* **Username:** `WAN1` *(Must match the comment in Cloudflare)*
* **Password:** `<Cloudflare API Token>`
* **Server:** `your-worker-subdomain.workers.dev/update?ip=%i&hostname=%h`
  > ⚠️ **IMPORTANT:** Do not include `https://` in the Server field. Do not include `%u` or `%p`.

### WAN 2
* **Service:** `Custom`
* **Hostname:** `example.com`
* **Username:** `WAN2` *(Must match the comment in Cloudflare)*
* **Password:** `<Cloudflare API Token>`
* **Server:** `your-worker-subdomain.workers.dev/update?ip=%i&hostname=%h`

## Troubleshooting
* `bad_tag`: Check if your Cloudflare DNS record actually has the comment `WAN1` or `WAN2`.
* `badauth`: Ensure your API Token is correct and has the necessary permissions.
