export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    const ip = url.searchParams.get("ip") || request.headers.get("CF-Connecting-IP");
    const hostname = url.searchParams.get("hostname");

    if (!ip || !hostname) return new Response("badreq", { status: 400 });

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return new Response("badauth - missing header", { status: 401 });
    }

    const decodedCredentials = atob(authHeader.substring(6));
    // We map the UniFi Username to the DNS Comment tag (e.g., "WAN1")
    const [wanTag, apiToken] = decodedCredentials.split(":"); 

    if (!wanTag || !apiToken) return new Response("badauth", { status: 401 });

    // 1. Get the Zone ID dynamically
    const zoneReq = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${hostname}`, {
      headers: { "Authorization": `Bearer ${apiToken}` }
    });
    const zoneData = await zoneReq.json();
    if (!zoneData.success || zoneData.result.length === 0) return new Response("bad_zone", { status: 400 });
    const zoneId = zoneData.result[0].id;

    // 2. Fetch all A records for this hostname
    const dnsReq = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${hostname}`, {
      headers: { "Authorization": `Bearer ${apiToken}` }
    });
    const dnsData = await dnsReq.json();
    if (!dnsData.success) return new Response("bad_dns_lookup", { status: 500 });

    // 3. Find the specific record that matches the comment tag (WAN1 or WAN2)
    const targetRecord = dnsData.result.find(record => record.comment === wanTag);

    if (!targetRecord) {
      return new Response(`bad_tag - no record found with comment: ${wanTag}`, { status: 404 });
    }

    // 4. Skip update if the IP hasn't actually changed
    if (targetRecord.content === ip) {
      return new Response(`nochg ${ip}`, { status: 200 });
    }

    // 5. Push the update to the exact matched record
    const updateReq = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${targetRecord.id}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "A",
        name: hostname, 
        content: ip,
        ttl: 120,
        proxied: false,
        comment: wanTag // Cloudflare requires we pass the comment back to retain it
      })
    });

    if (updateReq.ok) {
      return new Response(`good ${ip}`, { status: 200 });
    } else {
      return new Response("cf_api_error", { status: 500 });
    }
  }
};
