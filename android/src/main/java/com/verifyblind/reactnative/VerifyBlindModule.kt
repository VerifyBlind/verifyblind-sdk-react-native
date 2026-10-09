package com.verifyblind.reactnative

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.verifyblind.sdk.VerifyBlindAndroidSDK
import com.verifyblind.sdk.VerifyBlindConfig
import com.verifyblind.sdk.VerifyBlindException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

/**
 * Thin wrapper around [VerifyBlindAndroidSDK].
 *
 * One SDK instance is kept per JS client (`instanceId`) so the temporary key pair made in
 * `startAuthentication` is still there when `checkVerificationResult` decrypts the answer.
 * Nothing from the result is logged here.
 */
class VerifyBlindModule(reactContext: ReactApplicationContext) :
  NativeVerifyBlindSpec(reactContext) {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  private val instances = ConcurrentHashMap<String, VerifyBlindAndroidSDK>()

  override fun startAuthentication(
    instanceId: String,
    config: ReadableMap,
    validations: ReadableMap?,
    customData: ReadableMap?,
    returnUrl: String?,
    promise: Promise
  ) {
    val sdk = try {
      VerifyBlindAndroidSDK(
        VerifyBlindConfig(
          partnerBackendUrl = config.stringOr("partnerBackendUrl", ""),
          generateEndpoint = config.stringOr("generateEndpoint", "."),
          verifyblindAppLinkBase = config.stringOr(
            "verifyblindAppLinkBase", "https://app.verifyblind.com/request"
          ),
          verifyblindApiUrl = config.stringOr("verifyblindApiUrl", "https://api.verifyblind.com")
        )
      )
    } catch (e: Exception) {
      promise.reject("INVALID_CONFIG", e.message ?: "Invalid VerifyBlind config.", e)
      return
    }
    // A new start replaces the previous session (and its key pair) for this client.
    instances[instanceId] = sdk

    val context = reactApplicationContext.currentActivity ?: reactApplicationContext
    scope.launch {
      try {
        val result = sdk.startAuthentication(
          context = context,
          validations = validations?.toPlainMap(),
          customData = customData?.toPlainMap(),
          returnUrl = returnUrl?.takeIf { it.isNotBlank() }
        )
        val out = Arguments.createMap()
        out.putString("nonce", result.nonce)
        out.putString("pkHash", result.pk_hash)
        promise.resolve(out)
      } catch (e: CancellationException) {
        promise.reject("UNKNOWN", "Cancelled.", e)
      } catch (e: VerifyBlindException) {
        rejectWith(promise, e)
      } catch (e: Exception) {
        promise.reject("UNKNOWN", e.message ?: "VerifyBlind start failed.", e)
      }
    }
  }

  override fun checkVerificationResult(instanceId: String, nonce: String, promise: Promise) {
    val sdk = instances[instanceId]
    if (sdk == null) {
      promise.reject(
        "NO_ACTIVE_SESSION",
        "No active VerifyBlind session. Call startAuthentication again (the app may have been restarted)."
      )
      return
    }
    scope.launch {
      try {
        val result = sdk.checkVerificationResult(nonce)
        promise.resolve(result?.let { toWritableMap(it) })
      } catch (e: CancellationException) {
        promise.reject("UNKNOWN", "Cancelled.", e)
      } catch (e: VerifyBlindException) {
        rejectWith(promise, e)
      } catch (e: Exception) {
        promise.reject("UNKNOWN", e.message ?: "VerifyBlind poll failed.", e)
      }
    }
  }

  override fun releaseInstance(instanceId: String) {
    instances.remove(instanceId)
  }

  override fun invalidate() {
    scope.cancel()
    instances.clear()
    super.invalidate()
  }

  private fun rejectWith(promise: Promise, e: VerifyBlindException) {
    val userInfo = Arguments.createMap()
    e.cancelReason?.let { userInfo.putString("cancelReason", it) }
    promise.reject(e.code.name, e.message ?: e.code.name, e, userInfo)
  }

  private fun ReadableMap.stringOr(key: String, fallback: String): String =
    if (hasKey(key) && getType(key) == ReadableType.String) getString(key) ?: fallback else fallback

  /** ReadableMap → Map<String, Any> without nulls (the SDK takes non-null values). */
  private fun ReadableMap.toPlainMap(): Map<String, Any> {
    val out = LinkedHashMap<String, Any>()
    for ((key, value) in toHashMap()) {
      if (value == null) continue
      // JS numbers arrive as Double; keep whole numbers as Int so JSON shows 18, not 18.0.
      out[key] = if (value is Double && value % 1.0 == 0.0 &&
        value >= Int.MIN_VALUE && value <= Int.MAX_VALUE) value.toInt() else value
    }
    return out
  }

  private fun toWritableMap(map: Map<*, *>): WritableMap {
    val out = Arguments.createMap()
    for ((k, v) in map) {
      val key = k?.toString() ?: continue
      when (v) {
        null -> out.putNull(key)
        is Boolean -> out.putBoolean(key, v)
        is Int -> out.putInt(key, v)
        is Long -> out.putDouble(key, v.toDouble())
        is Number -> out.putDouble(key, v.toDouble())
        is String -> out.putString(key, v)
        is Map<*, *> -> out.putMap(key, toWritableMap(v))
        is Iterable<*> -> out.putArray(key, toWritableArray(v))
        else -> out.putString(key, v.toString())
      }
    }
    return out
  }

  private fun toWritableArray(list: Iterable<*>): WritableArray {
    val out = Arguments.createArray()
    for (v in list) {
      when (v) {
        null -> out.pushNull()
        is Boolean -> out.pushBoolean(v)
        is Int -> out.pushInt(v)
        is Number -> out.pushDouble(v.toDouble())
        is String -> out.pushString(v)
        is Map<*, *> -> out.pushMap(toWritableMap(v))
        is Iterable<*> -> out.pushArray(toWritableArray(v))
        else -> out.pushString(v.toString())
      }
    }
    return out
  }

  companion object {
    const val NAME = NativeVerifyBlindSpec.NAME
  }
}
