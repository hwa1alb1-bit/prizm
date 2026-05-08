export type SettingsSummary = {
  account: {
    email: string
    fullName: string | null
    role: string
  }
  workspace: {
    id: string
    name: string
    defaultRegion: string
    memberCount: number
    createdAt: string
  }
  controls: {
    retentionHours: number
    maxPdfSizeMb: number
    exportFormats: string[]
    securityEmail: string
  }
}
