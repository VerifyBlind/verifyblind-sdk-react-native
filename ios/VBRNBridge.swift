import Foundation
import VerifyBlind

/// Swift side of the React Native module. The native iOS SDK is Swift-only (async/await),
/// so the Objective-C++ TurboModule (`VerifyBlindReactNative.mm`) calls into this class.
///
/// One `VerifyBlindSDK` is kept per JS client (`instanceId`) so the temporary key pair made in
/// `startAuthentication` is still there when `checkVerificationResult` decrypts the answer.
/// Nothing from the result is logged here.
@objc(VBRNBridge)
public final class VBRNBridge: NSObject {

    private var instances: [String: VerifyBlindSDK] = [:]
    private let lock = NSLock()

    private func set(_ sdk: VerifyBlindSDK?, for id: String) {
        lock.lock(); defer { lock.unlock() }
        instances[id] = sdk
    }

    private func get(_ id: String) -> VerifyBlindSDK? {
        lock.lock(); defer { lock.unlock() }
        return instances[id]
    }

    private static func string(_ dict: NSDictionary, _ key: String, _ fallback: String) -> String {
        guard let value = (dict[key] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else { return fallback }
        return value
    }

    @objc(startWithInstanceId:config:validations:customData:returnUrl:resolve:reject:)
    public func start(instanceId: String,
                      config: NSDictionary,
                      validations: NSDictionary?,
                      customData: NSDictionary?,
                      returnUrl: String?,
                      resolve: @escaping (NSDictionary) -> Void,
                      reject: @escaping (String, String, String?) -> Void) {
        let partner = Self.string(config, "partnerBackendUrl", "")
        guard !partner.isEmpty else {
            reject("INVALID_CONFIG", "partnerBackendUrl must not be empty.", nil)
            return
        }
        let sdk = VerifyBlindSDK(config: VerifyBlindConfig(
            partnerBackendUrl: partner,
            generateEndpoint: Self.string(config, "generateEndpoint", "."),
            verifyblindAppLinkBase: Self.string(config, "verifyblindAppLinkBase",
                                                "https://app.verifyblind.com/request"),
            verifyblindApiUrl: Self.string(config, "verifyblindApiUrl", "https://api.verifyblind.com")
        ))
        // A new start replaces the previous session (and its key pair) for this client.
        set(sdk, for: instanceId)

        let vals = validations as? [String: Any]
        let custom = customData as? [String: Any]
        let ret = (returnUrl?.isEmpty == false) ? returnUrl : nil

        Task {
            do {
                let result = try await sdk.startAuthentication(validations: vals,
                                                               customData: custom,
                                                               returnUrl: ret)
                resolve(["nonce": result.nonce, "pkHash": result.pkHash])
            } catch let e as VerifyBlindError {
                reject(e.code.rawValue, e.message, e.cancelReason)
            } catch {
                reject("UNKNOWN", error.localizedDescription, nil)
            }
        }
    }

    @objc(checkWithInstanceId:nonce:resolve:reject:)
    public func check(instanceId: String,
                      nonce: String,
                      resolve: @escaping (NSDictionary?) -> Void,
                      reject: @escaping (String, String, String?) -> Void) {
        guard let sdk = get(instanceId) else {
            reject("NO_ACTIVE_SESSION",
                   "No active VerifyBlind session. Call startAuthentication again (the app may have been restarted).",
                   nil)
            return
        }
        Task {
            do {
                if let result = try await sdk.checkVerificationResult(nonce: nonce) {
                    resolve(result as NSDictionary)
                } else {
                    resolve(nil)
                }
            } catch let e as VerifyBlindError {
                reject(e.code.rawValue, e.message, e.cancelReason)
            } catch {
                // Transient network errors while polling: treat as "not ready yet", like Android.
                resolve(nil)
            }
        }
    }

    @objc(releaseWithInstanceId:)
    public func release(instanceId: String) {
        set(nil, for: instanceId)
    }
}
