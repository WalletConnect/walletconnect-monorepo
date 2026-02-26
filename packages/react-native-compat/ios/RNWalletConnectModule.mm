#import "RNWalletConnectModule.h"

@implementation RNWalletConnectModule
RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(isAppInstalled:(NSString *)bundleID
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    BOOL result = [self checkAppInstalled:bundleID];
    resolve(@(result));
}

+ (BOOL)requiresMainQueueSetup
{
   return NO;
}

- (NSDictionary *)constantsToExport
{
 return @{ 
    @"applicationName": [self getAppName],
    @"applicationId": [self getBundleId],
  };
}

- (NSString *) getAppName {
    NSString *displayName = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleDisplayName"];
    NSString *bundleName = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleName"];
    return displayName ? displayName : bundleName;
}

- (NSString *) getBundleId {
    return [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleIdentifier"];
}

- (BOOL)checkAppInstalled:(NSString *)bundleID {
    NSURL *appURL = [NSURL URLWithString:[NSString stringWithFormat:@"%@://", bundleID]];
    return [[UIApplication sharedApplication] canOpenURL:appURL];
}

- (NSDictionary *)getConstants {
    return [self constantsToExport];
}

// Don't compile this code when we build for the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNWalletConnectModuleSpecJSI>(params);
}
#endif

@end
