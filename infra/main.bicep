param appName string
param cosmosName string
param staticLocation string = 'eastasia'
param databaseLocation string = 'japaneast'

resource site 'Microsoft.Web/staticSites@2023-12-01' = {
  name: appName
  location: staticLocation
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    allowConfigFileUpdates: true
  }
}
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosName
  location: databaseLocation
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: true
    enableAutomaticFailover: false
    locations: [
      {
        locationName: databaseLocation
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    publicNetworkAccess: 'Enabled'
  }
}
resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmos
  name: 'schedule'
  properties: {
    resource: {
      id: 'schedule'
    }
  }
}
resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'records'
  properties: {
    resource: {
      id: 'records'
      partitionKey: {
        paths: ['/pk']
        kind: 'Hash'
      }
      defaultTtl: -1
    }
    options: {
      throughput: 400
    }
  }
}
output siteUrl string = 'https://${site.properties.defaultHostname}'
output staticSiteName string = site.name
output cosmosAccountName string = cosmos.name
