# Deploying Playtika Art Studio to Azure App Service

This sets up the app on Azure with **Entra ID single sign-on** (so only Playtika
employees can reach it) and optional **SharePoint upload** for generated
videos. End-to-end takes ~20–30 minutes the first time.

## 0. Prerequisites

- Azure CLI signed in: `az login`
- Subscription selected: `az account set --subscription "<name-or-id>"`
- Permissions to create resources + register Entra ID apps in your tenant

## 1. Create the resource group

```bash
az group create --name rg-playtika-art-studio --location westeurope
```

## 2. Register an Entra ID app for Easy Auth (recommended)

This is the app users will SSO against.

```bash
az ad app create \
  --display-name "Playtika Art Studio" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://placeholder/.auth/login/aad/callback"
```

Note the `appId` — that's your `aadClientId`.

> You'll come back and replace the `placeholder` URL with the real site URL
> after step 3.

## 3. Deploy infrastructure (Bicep)

```bash
az deployment group create \
  --resource-group rg-playtika-art-studio \
  --template-file infra/main.bicep \
  --parameters \
      namePrefix=playtika-art-studio \
      geminiApiKey='<your-Gemini-key>' \
      enableAadAuth=true \
      aadClientId='<appId-from-step-2>'
```

Output gives you `siteUrl`, e.g. `https://playtika-art-studio-abc123.azurewebsites.net`.

Now update the Entra ID app's redirect URI to the real URL:

```bash
az ad app update --id <appId> \
  --web-redirect-uris "https://<siteUrl>/.auth/login/aad/callback"
```

## 4. Deploy the code

Two options:

### A. One-shot zip deploy (quickest)

```bash
# from the repo root, on the branch you want to ship
zip -r app.zip . -x "node_modules/*" -x ".git/*" -x "dist/*" -x ".env"
az webapp deploy \
  --resource-group rg-playtika-art-studio \
  --name <siteName-from-bicep-output> \
  --src-path app.zip \
  --type zip
```

App Service will run `npm install` and `npm start` (which builds the React
bundle and starts Express on the platform-provided `PORT`).

### B. GitHub Actions (recommended for the team)

A starter workflow is at `.github/workflows/azure-deploy.yml`. To enable:

1. In Azure portal → your App Service → **Get publish profile**, download it.
2. In GitHub → repo → Settings → Secrets → Actions, create:
   - `AZURE_WEBAPP_PUBLISH_PROFILE` = paste the publish profile XML
   - `AZURE_WEBAPP_NAME` = your site name
3. Push to `main` (or run the workflow manually).

## 5. Optional: enable SharePoint video upload

This lets every generated video auto-save into a shared SharePoint document
library — perfect for marketing/social to discover and reuse.

### 5a. Register a second Entra ID app for Graph (app-only)

```bash
az ad app create --display-name "Playtika Art Studio - Graph"
# note the appId
az ad app credential reset --id <graphAppId> --display-name "art-studio-secret"
# note the secret value
```

Grant it **Sites.Selected** permission (least privilege):

```bash
# Find the Microsoft Graph service principal
GRAPH_APP_ID=00000003-0000-0000-c000-000000000000
SITES_SELECTED_ID=$(az ad sp show --id $GRAPH_APP_ID \
  --query "appRoles[?value=='Sites.Selected'].id | [0]" -o tsv)

az ad app permission add --id <graphAppId> \
  --api $GRAPH_APP_ID \
  --api-permissions ${SITES_SELECTED_ID}=Role

az ad app permission admin-consent --id <graphAppId>
```

Then on your target SharePoint site, grant this app **write** access:

```bash
# get site id
SITE_ID=$(curl -sH "Authorization: Bearer $(az account get-access-token \
  --resource https://graph.microsoft.com --query accessToken -o tsv)" \
  "https://graph.microsoft.com/v1.0/sites/<hostname>:/sites/<site-path>" \
  | jq -r .id)

# grant the app write to that site only
curl -X POST "https://graph.microsoft.com/v1.0/sites/$SITE_ID/permissions" \
  -H "Authorization: Bearer $(az account get-access-token \
    --resource https://graph.microsoft.com --query accessToken -o tsv)" \
  -H "Content-Type: application/json" \
  -d '{
        "roles": ["write"],
        "grantedToIdentities": [{
          "application": { "id": "<graphAppId>", "displayName": "Playtika Art Studio - Graph" }
        }]
      }'
```

### 5b. Set the env vars on App Service

```bash
az webapp config appsettings set \
  --resource-group rg-playtika-art-studio \
  --name <siteName> \
  --settings \
    MS_TENANT_ID=<your-tenant-id> \
    MS_CLIENT_ID=<graphAppId> \
    MS_CLIENT_SECRET=<secret-from-credential-reset> \
    MS_SHAREPOINT_HOSTNAME=playtika.sharepoint.com \
    MS_SHAREPOINT_SITE_PATH=/sites/Marketing \
    MS_SHAREPOINT_FOLDER='Art Studio'
```

The app will now upload every generated MP4 to
`Marketing > Art Studio` and show an "Open in SharePoint" button next to
the download button on each video card.

## 6. Embed in your SharePoint internal site

In the destination SharePoint page:

1. Edit page → **+** → **Embed** web part
2. Paste `<iframe src="https://<siteUrl>" width="100%" height="900" allow="clipboard-read; clipboard-write"></iframe>`
3. Save & publish

Because Easy Auth uses the same Entra ID tenant, the iframe will SSO
silently — users see the studio inline on the SharePoint page.

## Notes

- **Costs**: B2 plan ≈ $55/month. Veo and Imagen costs are billed by Google
  separately and dominate beyond a small team's usage.
- **Per-instance video state**: video jobs are tracked in-memory and on the
  local disk. If you scale to multiple App Service instances, add sticky
  sessions or move to a shared store (Blob + Table/Redis). Single instance is
  fine for the marketing department's volume.
- **Key rotation**: rotate `GEMINI_API_KEY` periodically. Same for
  `MS_CLIENT_SECRET`.
- **Logs**: `az webapp log tail -g rg-playtika-art-studio -n <siteName>`.
