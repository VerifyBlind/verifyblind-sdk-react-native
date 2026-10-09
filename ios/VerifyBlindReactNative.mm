#import "VerifyBlindReactNative.h"

#if __has_include(<VerifyBlindReactNative/VerifyBlindReactNative-Swift.h>)
#import <VerifyBlindReactNative/VerifyBlindReactNative-Swift.h>
#else
#import "VerifyBlindReactNative-Swift.h"
#endif

static NSError *VBRNError(NSString *message, NSString *_Nullable cancelReason)
{
  NSMutableDictionary *info = [NSMutableDictionary dictionaryWithObject:message ?: @"VerifyBlind error"
                                                                 forKey:NSLocalizedDescriptionKey];
  if (cancelReason.length > 0) {
    info[@"cancelReason"] = cancelReason;
  }
  return [NSError errorWithDomain:@"VerifyBlind" code:0 userInfo:info];
}

@implementation VerifyBlindReactNative {
  VBRNBridge *_impl;
}

- (instancetype)init
{
  if (self = [super init]) {
    _impl = [VBRNBridge new];
  }
  return self;
}

- (void)startAuthentication:(NSString *)instanceId
                     config:(NSDictionary *)config
                validations:(NSDictionary *_Nullable)validations
                 customData:(NSDictionary *_Nullable)customData
                  returnUrl:(NSString *_Nullable)returnUrl
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  [_impl startWithInstanceId:instanceId
                      config:config
                 validations:validations
                  customData:customData
                   returnUrl:returnUrl
                     resolve:^(NSDictionary *result) { resolve(result); }
                      reject:^(NSString *code, NSString *message, NSString *_Nullable cancelReason) {
                        reject(code, message, VBRNError(message, cancelReason));
                      }];
}

- (void)checkVerificationResult:(NSString *)instanceId
                          nonce:(NSString *)nonce
                        resolve:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
  [_impl checkWithInstanceId:instanceId
                       nonce:nonce
                     resolve:^(NSDictionary *_Nullable result) { resolve(result); }
                      reject:^(NSString *code, NSString *message, NSString *_Nullable cancelReason) {
                        reject(code, message, VBRNError(message, cancelReason));
                      }];
}

- (void)releaseInstance:(NSString *)instanceId
{
  [_impl releaseWithInstanceId:instanceId];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeVerifyBlindSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"VerifyBlindReactNative";
}

@end
