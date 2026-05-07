import 'server-only'

const UNKNOWN_VERSION = 'dev'

export function getReleaseVersion(env: NodeJS.ProcessEnv = process.env): string {
  return (
    firstPresent([
      env.VERCEL_GIT_COMMIT_SHA,
      env.NEXT_PUBLIC_GIT_SHA,
      env.SENTRY_RELEASE,
      env.VERCEL_DEPLOYMENT_ID,
    ]) ?? UNKNOWN_VERSION
  )
}

function firstPresent(values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim()
}
