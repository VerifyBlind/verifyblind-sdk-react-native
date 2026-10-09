import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import NativeVerifyBlind from '../NativeVerifyBlind';
import { createVerifyBlind, VerifyBlindError } from '../index';

jest.mock('../NativeVerifyBlind', () => {
  const { jest: j } = require('@jest/globals');
  return {
    __esModule: true,
    default: {
      startAuthentication: j.fn(),
      checkVerificationResult: j.fn(),
      releaseInstance: j.fn(),
    },
  };
});

type AnyFn = (...args: any[]) => any;
const mockNative = NativeVerifyBlind as unknown as {
  startAuthentication: jest.Mock<AnyFn>;
  checkVerificationResult: jest.Mock<AnyFn>;
  releaseInstance: jest.Mock<AnyFn>;
};

describe('createVerifyBlind', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an empty partnerBackendUrl', () => {
    expect(() => createVerifyBlind({ partnerBackendUrl: '  ' })).toThrow(
      VerifyBlindError
    );
  });

  it('fills defaults and keeps one instance id between start and poll', async () => {
    mockNative.startAuthentication.mockResolvedValue({
      nonce: 'n1',
      pkHash: 'h',
    });
    mockNative.checkVerificationResult.mockResolvedValue({ token: 't' });

    const vb = createVerifyBlind({
      partnerBackendUrl: 'https://p.example.com/api',
      generateEndpoint: 'generate',
    });
    const start = await vb.startAuthentication({
      validations: { age: '18+' },
      returnUrl: 'myapp://callback',
    });
    expect(start).toEqual({ nonce: 'n1', pkHash: 'h' });

    const [id, config, validations, customData, returnUrl] =
      mockNative.startAuthentication.mock.calls[0]!;
    expect(config).toEqual({
      partnerBackendUrl: 'https://p.example.com/api',
      generateEndpoint: 'generate',
      verifyblindAppLinkBase: 'https://app.verifyblind.com/request',
      verifyblindApiUrl: 'https://api.verifyblind.com',
    });
    expect(validations).toEqual({ age: '18+' });
    expect(customData).toBeNull();
    expect(returnUrl).toBe('myapp://callback');

    const result = await vb.checkVerificationResult('n1');
    expect(result).toEqual({ token: 't' });
    expect(mockNative.checkVerificationResult.mock.calls[0]![0]).toBe(id);

    vb.release();
    expect(mockNative.releaseInstance).toHaveBeenCalledWith(id);
  });

  it('returns null while waiting', async () => {
    mockNative.checkVerificationResult.mockResolvedValue(null);
    const vb = createVerifyBlind({ partnerBackendUrl: 'https://p' });
    await expect(vb.checkVerificationResult('n')).resolves.toBeNull();
  });

  it('maps a native cancel into code + cancelReason', async () => {
    mockNative.checkVerificationResult.mockRejectedValue(
      Object.assign(new Error('declined'), {
        code: 'USER_CANCELLED',
        userInfo: { cancelReason: 'user_declined' },
      })
    );
    const vb = createVerifyBlind({ partnerBackendUrl: 'https://p' });
    const err = (await vb
      .checkVerificationResult('n')
      .catch((e: unknown) => e)) as VerifyBlindError;
    expect(err).toBeInstanceOf(VerifyBlindError);
    expect(err.code).toBe('USER_CANCELLED');
    expect(err.cancelReason).toBe('user_declined');
  });

  it('maps unknown native codes to UNKNOWN', async () => {
    mockNative.startAuthentication.mockRejectedValue(
      Object.assign(new Error('x'), { code: 'E_WEIRD' })
    );
    const vb = createVerifyBlind({ partnerBackendUrl: 'https://p' });
    const err = (await vb
      .startAuthentication()
      .catch((e: unknown) => e)) as VerifyBlindError;
    expect(err.code).toBe('UNKNOWN');
    expect(err.cancelReason).toBeUndefined();
  });
});
