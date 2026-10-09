import type { CancelReason, VerifyBlindErrorCode } from './types';

const KNOWN_CODES: ReadonlyArray<VerifyBlindErrorCode> = [
  'NETWORK_ERROR',
  'PARTNER_BACKEND_ERROR',
  'INVALID_RESPONSE',
  'APP_LINK_FAILED',
  'USER_CANCELLED',
  'CRYPTO_ERROR',
  'IP_FETCH_FAILED',
  'NO_ACTIVE_SESSION',
  'INVALID_CONFIG',
  'UNSUPPORTED_PLATFORM',
  'UNKNOWN',
];

/** Error thrown by every VerifyBlind call. Mirrors the native `VerifyBlindException` / `VerifyBlindError`. */
export class VerifyBlindError extends Error {
  readonly code: VerifyBlindErrorCode;
  /** Set only when `code === 'USER_CANCELLED'`. */
  readonly cancelReason?: CancelReason;

  constructor(
    message: string,
    code: VerifyBlindErrorCode = 'UNKNOWN',
    cancelReason?: CancelReason
  ) {
    super(message);
    this.name = 'VerifyBlindError';
    this.code = code;
    if (cancelReason != null) this.cancelReason = cancelReason;
  }
}

export function isVerifyBlindError(e: unknown): e is VerifyBlindError {
  return e instanceof VerifyBlindError;
}

/** Converts a rejected native promise into a `VerifyBlindError`. */
export function toVerifyBlindError(e: unknown): VerifyBlindError {
  if (e instanceof VerifyBlindError) return e;
  const raw = (e ?? {}) as {
    code?: unknown;
    message?: unknown;
    userInfo?: { cancelReason?: unknown } | null;
  };
  const code =
    typeof raw.code === 'string' &&
    (KNOWN_CODES as ReadonlyArray<string>).includes(raw.code)
      ? (raw.code as VerifyBlindErrorCode)
      : 'UNKNOWN';
  const message =
    typeof raw.message === 'string' && raw.message.length > 0
      ? raw.message
      : 'VerifyBlind error';
  const reason = raw.userInfo?.cancelReason;
  const cancelReason =
    code === 'USER_CANCELLED'
      ? typeof reason === 'string' && reason.length > 0
        ? reason
        : 'user_cancelled'
      : undefined;
  return new VerifyBlindError(message, code, cancelReason);
}
