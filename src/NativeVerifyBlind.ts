import {
  TurboModuleRegistry,
  type TurboModule,
  type CodegenTypes,
} from 'react-native';

/**
 * Native bridge spec (codegen). Do not use directly; use `createVerifyBlind()`.
 *
 * The native side keeps one VerifyBlind SDK instance per `instanceId`, so the
 * temporary key pair created in `startAuthentication` is still there when
 * `checkVerificationResult` decrypts the answer.
 */
export interface Spec extends TurboModule {
  startAuthentication(
    instanceId: string,
    config: CodegenTypes.UnsafeObject,
    validations: CodegenTypes.UnsafeObject | null,
    customData: CodegenTypes.UnsafeObject | null,
    returnUrl: string | null
  ): Promise<CodegenTypes.UnsafeObject>;

  checkVerificationResult(
    instanceId: string,
    nonce: string
  ): Promise<CodegenTypes.UnsafeObject | null>;

  releaseInstance(instanceId: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('VerifyBlindReactNative');
