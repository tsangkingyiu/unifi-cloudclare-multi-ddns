export default {
  async fetch(request, env) {
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
