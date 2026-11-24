#import "RNWalletConnectModule.h"

#import <UIKit/UIKit.h>

@implementation RNWalletConnectModule
RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(isAppInstalled:(NSString *)bundleID
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    // Never rejects: any failure resolves NO.
    @try {
        NSString *scheme = [RNWalletConnectModule normalizedScheme:bundleID];
        if (scheme == nil) {
            resolve(@(NO));
            return;
        }
        // UIApplication is main-thread only; this module's methods run on a background queue.
        dispatch_async(dispatch_get_main_queue(), ^{
            resolve(@([RNWalletConnectModule canOpenScheme:scheme]));
        });
    } @catch (NSException *exception) {
        resolve(@(NO));
    }
}

RCT_EXPORT_METHOD(getInstalledApps:(NSArray *)identifiers
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    // Never rejects: any failure resolves an empty list.
    @try {
        if (![identifiers isKindOfClass:[NSArray class]] || identifiers.count == 0) {
            resolve(@[]);
            return;
        }
        // Normalize off the main thread, keeping each original identifier so callers can match
        // results against what they passed in.
        NSMutableArray<NSString *> *originals = [NSMutableArray arrayWithCapacity:identifiers.count];
        NSMutableArray<NSString *> *schemes = [NSMutableArray arrayWithCapacity:identifiers.count];
        for (id identifier in identifiers) {
            NSString *scheme = [RNWalletConnectModule normalizedScheme:identifier];
            if (scheme != nil) {
                [originals addObject:identifier];
                [schemes addObject:scheme];
            }
        }
        if (schemes.count == 0) {
            resolve(@[]);
            return;
        }
        [RNWalletConnectModule checkSchemes:schemes
                                  originals:originals
                                      start:0
                                  installed:[NSMutableArray array]
                                    resolve:resolve];
    } @catch (NSException *exception) {
        resolve(@[]);
    }
}

// Checks schemes on the main queue in small chunks, yielding between chunks so a large list
// (hundreds of wallets) never blocks the UI for more than a few milliseconds at a time.
static const NSUInteger kSchemesPerMainQueueTurn = 16;

+ (void)checkSchemes:(NSArray<NSString *> *)schemes
           originals:(NSArray<NSString *> *)originals
               start:(NSUInteger)start
           installed:(NSMutableArray<NSString *> *)installed
             resolve:(RCTPromiseResolveBlock)resolve
{
    dispatch_async(dispatch_get_main_queue(), ^{
        NSUInteger end = MIN(start + kSchemesPerMainQueueTurn, schemes.count);
        for (NSUInteger i = start; i < end; i++) {
            if ([RNWalletConnectModule canOpenScheme:schemes[i]]) {
                [installed addObject:originals[i]];
            }
        }
        if (end >= schemes.count) {
            resolve([installed copy]);
        } else {
            [RNWalletConnectModule checkSchemes:schemes
                                      originals:originals
                                          start:end
                                      installed:installed
                                        resolve:resolve];
        }
    });
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

// Accepts a bare scheme ("metamask"), a scheme with separator ("metamask://") or a full URL
// ("metamask://wc?uri=..."), and returns only the scheme. Returns nil for nil, empty or
// malformed input (RFC 3986: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )).
+ (nullable NSString *)normalizedScheme:(id)input {
    if (![input isKindOfClass:[NSString class]]) {
        return nil;
    }
    NSString *trimmed = [(NSString *)input stringByTrimmingCharactersInSet:
                         [NSCharacterSet whitespaceAndNewlineCharacterSet]];
    NSRange separator = [trimmed rangeOfString:@":"];
    NSString *scheme = separator.location == NSNotFound ? trimmed : [trimmed substringToIndex:separator.location];
    if (scheme.length == 0) {
        return nil;
    }
    static NSCharacterSet *invalidCharacters;
    static NSCharacterSet *letters;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSString *ascii = @"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        letters = [NSCharacterSet characterSetWithCharactersInString:ascii];
        invalidCharacters = [[NSCharacterSet characterSetWithCharactersInString:
                              [ascii stringByAppendingString:@"0123456789+-."]] invertedSet];
    });
    if (![letters characterIsMember:[scheme characterAtIndex:0]] ||
        [scheme rangeOfCharacterFromSet:invalidCharacters].location != NSNotFound) {
        return nil;
    }
    return scheme;
}

// Must run on the main thread. Never throws: any failure counts as "not installed".
+ (BOOL)canOpenScheme:(NSString *)scheme {
    @try {
        NSURL *url = [NSURL URLWithString:[scheme stringByAppendingString:@"://"]];
        if (url == nil) {
            return NO;
        }
        return [[UIApplication sharedApplication] canOpenURL:url];
    } @catch (NSException *exception) {
        return NO;
    }
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
