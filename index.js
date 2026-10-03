export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const params = url.searchParams;

    // 1. Extract Identity & Network Data
    const hostname = params.get("hostname") || params.get("host");
    const ip = params.get("ip") || params.get("myip") || request.headers.get("CF-Connecting-IP");

    console.log(`[Request] Host: ${hostname}, IP: ${ip}`);

    // 2. Extract Credentials from Basic Auth
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      console.error("[Auth] Missing Authorization Header");
      return new Response("badauth", { status: 401 });
    }

    const [username, password] = atob(authHeader.split(" ")[1]).split(":");
    // Username = The "Comment" tag (WAN1/WAN2) or Record ID
    // Password = Cloudflare API Token
    const apiToken = password;
    const wanTag = username; 

    if (!hostname || !ip || !apiToken || !wanTag) {
      console.error("[Auth] Missing required parameters (Host/IP/Token/Tag)");
      return new Response("badreq", { status: 400 });
    }

    try {
      // 3. Dynamic Zone Lookup
      console.log(`[Cloudflare] Looking up Zone ID for: ${hostname}`);
      const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${hostname.split('.').slice(-2).join('.')}`, {
        headers: { "Authorization": `Bearer ${apiToken}` }
      });
      const zoneData = await zoneRes.json();

      if (!zoneData.success || zoneData.result.length === 0) {
        console.error("[Cloudflare] Zone not found or Token invalid", zoneData.errors);
        return new Response("badauth", { status: 401 });
      }
      const zoneId = zoneData.result[0].id;
      console.log(`[Cloudflare] Zone ID identified: ${zoneId}`);

      // Account-level resources (WAF IP Lists) live under the account that owns the zone.
      const accountId = zoneData.result[0].account.id;
      console.log(`[Cloudflare] Account ID identified: ${accountId}`);

      // 4. Find the Specific DNS Record by Name AND Comment
      // We list records for the hostname to find which one matches our WAN tag
      console.log(`[Cloudflare] Searching for A record with comment: ${wanTag}`);
      const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${hostname}`, {
        headers: { "Authorization": `Bearer ${apiToken}` }
      });
      const dnsData = await dnsRes.json();

      if (!dnsData.success) {
        console.error("[Cloudflare] DNS Fetch failed", dnsData.errors);
        return new Response("911", { status: 500 });
      }

      // Filter by the comment we set (WAN1 or WAN2)
      const record = dnsData.result.find(r => r.comment === wanTag || r.id === wanTag);

      if (!record) {
        console.error(`[Cloudflare] No record found matching hostname ${hostname} and identifier ${wanTag}`);
        return new Response("nohost", { status: 404 });
      }

      // 5. Check if update is needed
      if (record.content === ip) {
        console.log(`[Success] IP matches current record (${ip}). No update needed.`);
        // 7. Even without a DNS change, make sure the WAF IP List carries this WAN's IP.
        await scheduleListSync(ctx, apiToken, accountId, wanTag, ip);
        return new Response("nochg", { status: 200 });
      }

      // 6. Perform the Update
      console.log(`[Cloudflare] Updating record ${record.id} to IP ${ip}`);
      const updateRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`, {
        method: "PATCH", // Using PATCH to only update IP and keep other settings
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: ip,
          comment: wanTag // Keep the comment so we can find it next time
        })
      });

      const updateData = await updateRes.json();

      if (updateData.success) {
        console.log(`[Success] Updated ${hostname} (${wanTag}) to ${ip}`);
        // 7. DNS succeeded — synchronize the account-level WAF IP List (non-blocking).
        await scheduleListSync(ctx, apiToken, accountId, wanTag, ip);
        return new Response("good", { status: 200 });
      } else {
        console.error("[Cloudflare] Update failed", updateData.errors);
        return new Response("911", { status: 500 });
      }

    } catch (e) {
      console.error("[Worker Error]", e.message);
      return new Response("911", { status: 500 });
    }
  }
};

// 7. WAF IP List synchronization (multi-WAN aware, best-effort only)
//
// Keeps the account-level Cloudflare List "my_trusted_ips" in sync with this WAN
// interface's current IP so WAF custom rules (e.g. "ip.src in $my_trusted_ips") keep
// trusting the gateway. Entries tagged for other WAN interfaces ("WAN2", ...) and
// manually added IPs are preserved verbatim.
// Entries are tagged with the RAW WAN tag (comment "WAN1"/"WAN2"), matching the
// username in UniFi and the DNS record comment.
//
// This step is NON-BLOCKING and NON-FATAL: it must never change the DDNS response the
// UniFi gateway receives ("good"/"nochg" whenever the DNS A record succeeded).
async function scheduleListSync(ctx, apiToken, accountId, wanTag, ip) {
  const job = syncTrustedIpsList(apiToken, accountId, wanTag, ip);
  try {
    if (ctx && typeof ctx.waitUntil === "function") {
      // Return the DDNS response right away; keep the Worker alive until the sync finishes.
      ctx.waitUntil(job);
      return;
    }
    // Fallback for runtimes without a Workers execution context (e.g. local tests).
    await job;
  } catch (e) {
    console.error("[IP List] Synchronization failed (non-fatal)", e?.message || e);
  }
}

async function syncTrustedIpsList(apiToken, accountId, wanTag, ip) {
  const LIST_NAME = "my_trusted_ips";
  // This WAN's entries are tagged with the raw WAN tag ("WAN1"); versions of the sync
  // before 1.3.1 wrote a "UniFi <tag>" prefix, so clean those up for this WAN as well.
  const ownedComments = [wanTag, "UniFi " + wanTag];

  try {
    // 7a. Locate the named account-level WAF IP List
    console.log(`[IP List] Looking up list "${LIST_NAME}" for account ${accountId}`);
    const listsRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/rules/lists`, {
      headers: { "Authorization": `Bearer ${apiToken}` }
    });
    const listsData = await listsRes.json();

    if (!listsData.success) {
      console.warn("[IP List] Could not read account lists (non-fatal)", listsData.errors);
      return;
    }

    const list = listsData.result.find(l => l.name === LIST_NAME);
    if (!list) {
      console.warn(`[IP List] List "${LIST_NAME}" not found for account ${accountId}. Skipping WAF list sync (create it under Account > Lists).`);
      return;
    }
    const listId = list.id;
    console.log(`[IP List] Found list "${LIST_NAME}" (${listId})`);

    // 7b. Fetch the current entries
    const itemsRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/rules/lists/${listId}/items`, {
      headers: { "Authorization": `Bearer ${apiToken}` }
    });
    const itemsData = await itemsRes.json();

    if (!itemsData.success) {
      console.warn(`[IP List] Could not read items of list "${LIST_NAME}" (non-fatal)`, itemsData.errors);
      return;
    }
    const currentItems = itemsData.result || [];
    console.log(`[IP List] List "${LIST_NAME}" currently has ${currentItems.length} entries`);

    // 7c. Keep every entry that does NOT belong to THIS WAN interface (manual IPs and
    // entries tagged for other WANs survive), then append/update ours with the raw tag.
    const updatedItems = currentItems.filter(item => !ownedComments.includes(item.comment));
    updatedItems.push({ ip: ip, comment: wanTag });

    // 7d. Overwrite the list with the reconciled entries.
    // NOTE: the Cloudflare API expects a bare item array here (NOT {"items": [...]}).
    console.log(`[IP List] Writing ${updatedItems.length} entries (${ip} tagged "${wanTag}")`);
    const putRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/rules/lists/${listId}/items`, {
      method: "PUT", // Replace all items in the list
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updatedItems)
    });
    const putData = await putRes.json();

    if (!putData.success) {
      console.warn(`[IP List] Failed to replace items in list "${LIST_NAME}" (non-fatal)`, putData.errors);
      return;
    }

    console.log(`[Success] WAF List "${LIST_NAME}" synchronized: ${ip} tagged "${wanTag}" (bulk op: ${putData.result?.operation_id || "n/a"})`);
  } catch (e) {
    // Any failure here is logged and swallowed: the DDNS workflow must not be affected.
    console.error("[IP List] Synchronization failed (non-fatal)", e?.message || e);
  }
}
