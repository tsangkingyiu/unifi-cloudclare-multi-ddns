export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Extract IP and Hostname from URL
    const ip = url.searchParams.get("ip") || request.headers.get("CF-Connecting-IP");
    const hostname = url.searchParams.get("hostname");

    if (!ip || !hostname) {
      return new Response("badreq", { status: 400 });
    }

    // Extract and decode the HTTP Basic Auth Header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return new Response("badauth - missing header", { status: 401 });
    }

    const base64Credentials = authHeader.substring(6);
    const decodedCredentials = atob(base64Credentials);
    
    // inadyn formats the Basic Auth payload as "username:password"
    const [recordId, apiToken] = decodedCredentials.split(":");

    if (!recordId || !apiToken) {
      return new Response("badauth - malformed credentials", { status: 401 });
    }

    // Look up the Zone ID dynamically using the API Token
    const zoneReq = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${hostname}`, {
      headers: { "Authorization": `Bearer ${apiToken}` }
    });
    const zoneData = await zoneReq.json();

    if (!zoneData.success || zoneData.result.length === 0) {
      return new Response("bad_zone_lookup", { status: 400 });
    }
    
    const dynamicZoneId = zoneData.result[0].id;

    // Update the specific Record ID on Cloudflare
    const cfApiUrl = `https://api.cloudflare.com/client/v4/zones/${dynamicZoneId}/dns_records/${recordId}`;
    
    const updateReq = await fetch(cfApiUrl, {
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
        proxied: false
      })
    });

    if (updateReq.ok) {
      return new Response(`good ${ip}`, { status: 200 });
    } else {
      return new Response("cf_api_error", { status: 500 });
    }
  }
};
