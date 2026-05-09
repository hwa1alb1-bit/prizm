import 'server-only'

export type ConnectorProbeResult = { ok: boolean; error?: string }

export type ConnectorProbe = {
  name: string
  required: boolean
  config: () => ConnectorProbeResult
  auth?: () => Promise<ConnectorProbeResult> | ConnectorProbeResult
  live?: () => Promise<ConnectorProbeResult> | ConnectorProbeResult
}

export type ConnectorStatus = {
  name: string
  ok: boolean
  required: boolean
  errorCode?: string
}

export type HealthSnapshot = {
  status: 'ok' | 'degraded'
  httpStatus: 200 | 503
  connectors: ConnectorStatus[]
}

export async function collectConnectorHealthSnapshot(
  probes: ConnectorProbe[],
  input: {
    deep: boolean
    includeErrorCodes: boolean
  },
): Promise<HealthSnapshot> {
  const connectors = await Promise.all(
    probes.map(async (probe) => runConnectorProbe(probe, input.deep, input.includeErrorCodes)),
  )
  const hasRequiredFailure = connectors.some((connector) => connector.required && !connector.ok)
  return {
    status: hasRequiredFailure ? 'degraded' : 'ok',
    httpStatus: hasRequiredFailure ? 503 : 200,
    connectors,
  }
}

async function runConnectorProbe(
  probe: ConnectorProbe,
  deep: boolean,
  includeErrorCodes: boolean,
): Promise<ConnectorStatus> {
  try {
    const config = probe.config()
    if (!config.ok || !deep) return connectorStatus(probe, config, includeErrorCodes)

    const auth = probe.auth ? await probe.auth() : config
    if (!auth.ok) return connectorStatus(probe, auth, includeErrorCodes)

    const live = probe.live ? await probe.live() : auth
    return connectorStatus(probe, live, includeErrorCodes)
  } catch {
    return {
      name: probe.name,
      ok: false,
      required: probe.required,
      ...(includeErrorCodes ? { errorCode: 'connector_exception' } : {}),
    }
  }
}

function connectorStatus(
  probe: ConnectorProbe,
  result: ConnectorProbeResult,
  includeErrorCodes: boolean,
): ConnectorStatus {
  return {
    name: probe.name,
    ok: result.ok,
    required: probe.required,
    ...(includeErrorCodes && !result.ok ? { errorCode: classifyHealthError(result.error) } : {}),
  }
}

function classifyHealthError(error: string | undefined): string {
  if (!error) return 'connector_failed'
  const normalized = error.toLowerCase()
  if (normalized.includes('missing') || normalized.includes('configured')) {
    return 'configuration_missing'
  }
  if (normalized.includes('timeout')) return 'connector_timeout'
  if (
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('accessdenied') ||
    normalized.includes('access denied')
  ) {
    return 'connector_auth_failed'
  }
  if (normalized.includes('needs a subscription for the service')) {
    return 'connector_subscription_required'
  }
  return 'connector_failed'
}
