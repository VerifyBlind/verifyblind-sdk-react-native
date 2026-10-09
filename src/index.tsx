import NativeVerifyBlind from './NativeVerifyBlind';
import { VerifyBlindError, toVerifyBlindError } from './errors';
import type {
  StartAuthenticationOptions,
  StartAuthenticationResult,
  VerificationResult,
  VerifyBlindClient,
  VerifyBlindConfig,
} from './types';

export * from './types';
export { VerifyBlindError, isVerifyBlindError } from './errors';

const DEFAULT_APP_LINK_BASE = 'https://app.verifyblind.com/request';
const DEFAULT_API_URL = 'https://api.verifyblind.com';

let instanceCounter = 0;

function newInstanceId(): string {
  instanceCounter += 1;
  return `vb-${Date.now().toString(36)}-${instanceCounter}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeConfig(
  config: VerifyBlindConfig
): Required<VerifyBlindConfig> {
  const partnerBackendUrl = config?.partnerBackendUrl?.trim();
  if (!partnerBackendUrl) {
    throw new VerifyBlindError(
      'partnerBackendUrl must not be empty.',
      'INVALID_CONFIG'
    );
  }
  return {
    partnerBackendUrl,
    generateEndpoint: config.generateEndpoint?.trim() || '.',
    verifyblindAppLinkBase:
      config.verifyblindAppLinkBase?.trim() || DEFAULT_APP_LINK_BASE,
    verifyblindApiUrl: config.verifyblindApiUrl?.trim() || DEFAULT_API_URL,
  };
}

/**
 * Creates a VerifyBlind client backed by the native Android / iOS SDK.
 *
 * ```ts
 * const vb = createVerifyBlind({ partnerBackendUrl: 'https://you.example.com/api', generateEndpoint: 'generate' });
 * const { nonce } = await vb.startAuthentication({ returnUrl: 'myapp://callback' });
 * // when the app is active again, poll:
 * const result = await vb.checkVerificationResult(nonce); // null = still waiting
 * // send result.token to YOUR server; decide there.
 * ```
 */
export function createVerifyBlind(
  config: VerifyBlindConfig
): VerifyBlindClient {
  const normalized = normalizeConfig(config);
  const instanceId = newInstanceId();

  return {
    async startAuthentication(
      options: StartAuthenticationOptions = {}
    ): Promise<StartAuthenticationResult> {
      try {
        const res = (await NativeVerifyBlind.startAuthentication(
          instanceId,
          normalized,
          options.validations ?? null,
          options.customData ?? null,
          options.returnUrl?.trim() || null
        )) as { nonce?: unknown; pkHash?: unknown };
        if (typeof res?.nonce !== 'string' || res.nonce.length === 0) {
          throw new VerifyBlindError(
            'Native SDK returned no nonce.',
            'INVALID_RESPONSE'
          );
        }
        return {
          nonce: res.nonce,
          pkHash: typeof res.pkHash === 'string' ? res.pkHash : '',
        };
      } catch (e) {
        throw toVerifyBlindError(e);
      }
    },

    async checkVerificationResult(
      nonce: string
    ): Promise<VerificationResult | null> {
      if (!nonce) {
        throw new VerifyBlindError(
          'nonce must not be empty.',
          'INVALID_CONFIG'
        );
      }
      try {
        const res = await NativeVerifyBlind.checkVerificationResult(
          instanceId,
          nonce
        );
        return (res as VerificationResult | null) ?? null;
      } catch (e) {
        throw toVerifyBlindError(e);
      }
    },

    release(): void {
      NativeVerifyBlind.releaseInstance(instanceId);
    },
  };
}
