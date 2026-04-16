# UniFi to Cloudflare DDNS (Stateless Worker)

A zero-configuration, secure Cloudflare Worker to update Cloudflare DNS records from a UniFi Gateway (UDM, UDM-Pro, UCG-Fiber, UXG, etc.) using the built-in Custom DDNS interface.

## Why This Exists
UniFi's built-in DDNS client (`inadyn`) struggles to update multiple A records for the exact same domain across multiple WANs (e.g., dual-WAN load balancing). 

This project acts as a translation layer at the edge. It leverages a specific behavior of `inadyn`: if you omit `%u` (username) and `%p` (password) from the update URL, UniFi securely transmits them via an HTTP Basic Auth header. This allows us to pass the specific Cloudflare **Record ID** and **API Token** directly from the UniFi GUI without exposing them in plaintext URL logs, and without hardcoding any variables into the Worker itself.

## Features
* **Zero Worker Configuration:** No environment variables or secrets need to be configured in the Cloudflare Dashboard.
* **Highly Secure:** API keys are sent via encrypted HTTP Authorization headers, preventing token leaks in proxy/firewall URL logs.
* **Dynamic Zone Lookup:** Automatically fetches the correct Cloudflare Zone ID on the fly based on the domain name.
* **Multi-WAN Capable:** Easily maintain dual A-records for the same root domain by specifying exact Record IDs per WAN interface.

## Prerequisites
1. **Cloudflare API Token:** Needs `Zone:Zone:Read` and `Zone:DNS:Edit` permissions.
2. **Cloudflare Record IDs:** You must manually create the A records in Cloudflare first, and obtain their specific Record IDs via the Cloudflare API.

## Installation & Deployment
1. Clone or fork this repository.
2. Log into your Cloudflare Dashboard.
3. Go to **Workers & Pages** -> **Create application** -> **Workers** -> **Connect to Git**.
4. Select your repository. Cloudflare will automatically detect the `wrangler.toml` file and deploy the Worker.
5. Note your assigned `workers.dev` URL (e.g., `unifi-cf-ddns.your-subdomain.workers.dev`).

## UniFi Configuration

In your UniFi Network Application, navigate to **Settings > Internet**. Configure your WAN interfaces as follows:

### WAN 1
* **Service:** `Custom`
* **Hostname:** `example.com` *(Your actual root domain)*
* **Username:** `<Insert Cloudflare Record ID for WAN1>`
* **Password:** `<Insert Cloudflare API Token>`
* **Server:** `your-worker-subdomain.workers.dev/update?ip=%i&hostname=%h`
  > ⚠️ **IMPORTANT:** Do not include `https://` or the `%u` / `%p` variables in the Server URL.

### WAN 2 (If applicable)
* **Service:** `Custom`
* **Hostname:** `example.com` 
* **Username:** `<Insert Cloudflare Record ID for WAN2>`
* **Password:** `<Insert Cloudflare API Token>`
* **Server:** `your-worker-subdomain.workers.dev/update?ip=%i&hostname=%h`

## Troubleshooting
If records are not updating, check the Cloudflare Worker logs:
* `badauth - missing header`: The `%u` and `%p` are likely still in your UniFi Server URL. Remove them.
* `bad_zone_lookup`: Your API token does not have `Zone:Zone:Read` permissions, or the domain is misspelled.
* `cf_api_error`: Your API token lacks `Zone:DNS:Edit` permissions, or the Record ID in the Username field is incorrect.
