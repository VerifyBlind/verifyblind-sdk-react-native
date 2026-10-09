/** Configuration, same fields as the native SDKs' `VerifyBlindConfig`. */
export interface VerifyBlindConfig {
  /**
   * Base URL of YOUR backend proxy (it adds the API key and forwards to VerifyBlind).
   * Example: `https://partner.example.com/api`
   */
  partnerBackendUrl: string;
  /** Path appended to `partnerBackendUrl` for the generate call. Default `"."` (the base URL itself). */
  generateEndpoint?: string;
  /** VerifyBlind App Link base. Default `https://app.verifyblind.com/request`. */
  verifyblindAppLinkBase?: string;
  /** VerifyBlind relay used for polling. Default `https://api.verifyblind.com`. */
  verifyblindApiUrl?: string;
}

/**
 * What to ask for, e.g. `{ age: '18+' }`. Your server's generate proxy should set the
 * real validations itself; whatever the app sends here is only a hint.
 */
export type Validations = Record<string, string | number | boolean>;

export interface StartAuthenticationOptions {
  validations?: Validations;
  /**
   * Deep link VerifyBlind opens when it is done, e.g. `myapp://callback`. Its scheme must be
   * registered in the Partner Portal (Settings, App Return Scheme) and in your app.
   */
  returnUrl?: string;
  /** Extra data passed to your generate proxy (`custom_data`). */
  customData?: Record<string, string | number | boolean>;
}

export interface StartAuthenticationResult {
  nonce: string;
  pkHash: string;
}

/**
 * Decrypted result. Fields depend on what was asked. `token` is the enclave-signed raw answer
 * (base64 of JSON `{ payload, signature }`): send it to your server and decide there.
 */
export interface VerificationResult {
  token?: string;
  [key: string]: unknown;
}

export type VerifyBlindErrorCode =
  | 'NETWORK_ERROR'
  | 'PARTNER_BACKEND_ERROR'
  | 'INVALID_RESPONSE'
  | 'APP_LINK_FAILED'
  | 'USER_CANCELLED'
  | 'CRYPTO_ERROR'
  | 'IP_FETCH_FAILED'
  /** `checkVerificationResult` called without a live session (not started, released, or the app process was restarted). */
  | 'NO_ACTIVE_SESSION'
  | 'INVALID_CONFIG'
  | 'UNSUPPORTED_PLATFORM'
  | 'UNKNOWN';

/** Reason sent with `USER_CANCELLED`. Treat unknown values like `user_cancelled`. */
export type CancelReason =
  | 'user_cancelled'
  | 'no_card_registered'
  | 'user_declined'
  | 'fingerprint_failed'
  | 'session_expired'
  | (string & {});

export interface VerifyBlindClient {
  /** Creates a temporary key pair, calls your generate proxy and opens the VerifyBlind app. */
  startAuthentication(
    options?: StartAuthenticationOptions
  ): Promise<StartAuthenticationResult>;
  /**
   * Polls once. Resolves `null` while the user has not finished yet. Rejects with
   * `VerifyBlindError` (`USER_CANCELLED` + `cancelReason`) if the user cancelled.
   */
  checkVerificationResult(nonce: string): Promise<VerificationResult | null>;
  /** Drops the native session (key pair). Call when you no longer poll. */
  release(): void;
}
