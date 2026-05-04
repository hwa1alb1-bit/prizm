import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider'
import { serverEnv } from '../shared/env'

export function getAwsCredentials() {
  if (serverEnv.AWS_ACCESS_KEY_ID && serverEnv.AWS_SECRET_ACCESS_KEY) {
    return async () => ({
      accessKeyId: serverEnv.AWS_ACCESS_KEY_ID!,
      secretAccessKey: serverEnv.AWS_SECRET_ACCESS_KEY!,
    })
  }

  if (serverEnv.AWS_ROLE_ARN) {
    return awsCredentialsProvider({
      roleArn: serverEnv.AWS_ROLE_ARN,
    })
  }

  return undefined
}
