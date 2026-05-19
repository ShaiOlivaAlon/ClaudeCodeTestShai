// Playtika Art Studio — Azure App Service (Linux, Node 20)
//
// Deploys:
//   - App Service Plan (Linux)
//   - Web App (Node 20) with HTTPS only, AlwaysOn, app settings
//   - Optional Entra ID Easy Auth (set `enableAadAuth: true` and provide `aadClientId`)
//
// Usage:
//   az group create -n rg-playtika-art-studio -l westeurope
//   az deployment group create \
//     -g rg-playtika-art-studio \
//     -f infra/main.bicep \
//     -p geminiApiKey=<paste> namePrefix=playtika-art-studio
//
// Then deploy the code:
//   az webapp deploy -g rg-playtika-art-studio -n <siteName> --src-path . --type zip
// (or use the GitHub Actions workflow in .github/workflows/azure-deploy.yml)

@description('Prefix for resource names. Site name is "<prefix>-<hash>".')
param namePrefix string = 'playtika-art-studio'

@description('Azure region.')
param location string = resourceGroup().location

@description('App Service Plan SKU. B2 is a reasonable starting point.')
@allowed([ 'B1', 'B2', 'B3', 'P0v3', 'P1v3', 'P2v3' ])
param sku string = 'B2'

@description('Gemini API key (Google AI Studio). Stored as an app setting; consider Key Vault for production.')
@secure()
param geminiApiKey string

@description('Enable Entra ID Easy Auth (recommended). Requires an Entra ID app registration; see deploy.md.')
param enableAadAuth bool = false

@description('Client ID of the Entra ID app registration. Required if enableAadAuth=true.')
param aadClientId string = ''

@description('Tenant ID — defaults to the deployment subscription tenant.')
param tenantId string = subscription().tenantId

@description('Optional SharePoint / OneDrive integration. Leave blank to disable video upload to SharePoint.')
param msTenantId string = ''
@secure()
param msClientSecret string = ''
param msClientId string = ''
param msSharepointHostname string = ''
param msSharepointSitePath string = ''
param msSharepointFolder string = 'Art Studio'

var siteName = '${namePrefix}-${uniqueString(resourceGroup().id)}'

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-plan'
  location: location
  sku: {
    name: sku
    tier: startsWith(sku, 'B') ? 'Basic' : 'PremiumV3'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: siteName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appCommandLine: 'npm start'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        { name: 'GEMINI_API_KEY', value: geminiApiKey }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'MS_TENANT_ID', value: msTenantId }
        { name: 'MS_CLIENT_ID', value: msClientId }
        { name: 'MS_CLIENT_SECRET', value: msClientSecret }
        { name: 'MS_SHAREPOINT_HOSTNAME', value: msSharepointHostname }
        { name: 'MS_SHAREPOINT_SITE_PATH', value: msSharepointSitePath }
        { name: 'MS_SHAREPOINT_FOLDER', value: msSharepointFolder }
      ]
    }
  }
}

// Entra ID "Easy Auth" — restricts the site to your tenant's users.
resource authV2 'Microsoft.Web/sites/config@2023-12-01' = if (enableAadAuth) {
  parent: site
  name: 'authsettingsV2'
  properties: {
    platform: {
      enabled: true
    }
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'azureactivedirectory'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          openIdIssuer: 'https://sts.windows.net/${tenantId}/v2.0'
          clientId: aadClientId
        }
        validation: {
          allowedAudiences: [
            'api://${aadClientId}'
          ]
        }
      }
    }
  }
}

output siteName string = site.name
output siteUrl string = 'https://${site.properties.defaultHostName}'
output principalId string = site.identity.principalId
