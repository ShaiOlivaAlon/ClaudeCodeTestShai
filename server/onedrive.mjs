// SharePoint Online upload via Microsoft Graph (app-only auth).
// Set MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SHAREPOINT_HOSTNAME
// and optionally MS_SHAREPOINT_SITE_PATH + MS_SHAREPOINT_FOLDER to enable.

let cachedSiteId = null;
let cachedToken = null;
let cachedTokenExpiry = 0;

export function isOneDriveConfigured() {
  return !!(
    process.env.MS_TENANT_ID &&
    process.env.MS_CLIENT_ID &&
    process.env.MS_CLIENT_SECRET &&
    process.env.MS_SHAREPOINT_HOSTNAME
  );
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60_000) return cachedToken;
  const tenantId = process.env.MS_TENANT_ID;
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MS_CLIENT_ID,
        client_secret: process.env.MS_CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Graph token request failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  cachedToken = json.access_token;
  cachedTokenExpiry = Date.now() + (json.expires_in || 3600) * 1000;
  return cachedToken;
}

async function getSiteId() {
  if (cachedSiteId) return cachedSiteId;
  const host = process.env.MS_SHAREPOINT_HOSTNAME;
  const sitePath = process.env.MS_SHAREPOINT_SITE_PATH || '';
  const token = await getAccessToken();
  const url = sitePath
    ? `https://graph.microsoft.com/v1.0/sites/${host}:${sitePath}`
    : `https://graph.microsoft.com/v1.0/sites/${host}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Graph site lookup failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  cachedSiteId = json.id;
  return cachedSiteId;
}

/**
 * Upload an MP4 (or any binary) to the configured SharePoint document library.
 * Returns { webUrl, downloadUrl, id } or null if not configured.
 */
export async function uploadToSharePoint(buffer, filename, mimeType = 'application/octet-stream') {
  if (!isOneDriveConfigured()) return null;

  const token = await getAccessToken();
  const siteId = await getSiteId();
  const folder = (process.env.MS_SHAREPOINT_FOLDER || 'Art Studio').replace(/^\/+|\/+$/g, '');
  const encodedPath = `${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;

  // Files <4MB can use single PUT; larger needs an upload session.
  if (buffer.length < 4 * 1024 * 1024) {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodedPath}:/content`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
        body: buffer,
      }
    );
    if (!res.ok) throw new Error(`SharePoint upload failed: ${res.status} ${await res.text()}`);
    const item = await res.json();
    return {
      webUrl: item.webUrl,
      downloadUrl: item['@microsoft.graph.downloadUrl'],
      id: item.id,
    };
  }

  // Resumable upload session
  const sessionRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodedPath}:/createUploadSession`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
    }
  );
  if (!sessionRes.ok) {
    throw new Error(`SharePoint session create failed: ${sessionRes.status} ${await sessionRes.text()}`);
  }
  const session = await sessionRes.json();

  const chunkSize = 5 * 1024 * 1024; // must be multiple of 320KiB; 5MB works
  for (let start = 0; start < buffer.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, buffer.length);
    const chunk = buffer.subarray(start, end);
    const res = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${start}-${end - 1}/${buffer.length}`,
      },
      body: chunk,
    });
    if (res.status === 200 || res.status === 201) {
      const item = await res.json();
      return {
        webUrl: item.webUrl,
        downloadUrl: item['@microsoft.graph.downloadUrl'],
        id: item.id,
      };
    }
    if (res.status !== 202) {
      throw new Error(`SharePoint chunk upload failed: ${res.status} ${await res.text()}`);
    }
  }
  throw new Error('SharePoint upload ended without final response');
}
