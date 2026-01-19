#import "RNWalletConnectPay.h"
#import <React/RCTBridge.h>

// Import the Swift bridge - this header is auto-generated
#if __has_include(<react_native_compat/react_native_compat-Swift.h>)
#import <react_native_compat/react_native_compat-Swift.h>
#elif __has_include("react_native_compat-Swift.h")
#import "react_native_compat-Swift.h"
#else
@class RNWalletConnectPayBridge;
#endif

@implementation RNWalletConnectPay {
    RNWalletConnectPayBridge *_bridge;
    dispatch_queue_t _queue;
}

RCT_EXPORT_MODULE()

- (instancetype)init
{
    self = [super init];
    if (self) {
        _queue = dispatch_queue_create("com.walletconnect.pay", DISPATCH_QUEUE_SERIAL);
        _bridge = [[RNWalletConnectPayBridge alloc] init];
    }
    return self;
}

/**
 * Initialize the Pay client with SDK configuration
 * @param configJson JSON string containing SDK config
 */
RCT_EXPORT_METHOD(initialize:(NSString *)configJson)
{
    dispatch_async(_queue, ^{
        NSError *error = nil;
        [self->_bridge initialize:configJson error:&error];
        if (error) {
            NSLog(@"[RNWalletConnectPay] Failed to initialize: %@", error.localizedDescription);
        }
    });
}

/**
 * Get payment options for a payment link
 * @param requestJson JSON request string
 * @param resolve Promise resolve callback
 * @param reject Promise reject callback
 */
RCT_EXPORT_METHOD(getPaymentOptions:(NSString *)requestJson
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(_queue, ^{
        [self->_bridge getPaymentOptions:requestJson completion:^(NSString *result, NSError *error) {
            if (error) {
                reject(@"PAY_ERROR", error.localizedDescription, error);
            } else {
                resolve(result);
            }
        }];
    });
}

/**
 * Get required payment actions for a selected option
 * @param requestJson JSON request string
 * @param resolve Promise resolve callback
 * @param reject Promise reject callback
 */
RCT_EXPORT_METHOD(getRequiredPaymentActions:(NSString *)requestJson
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(_queue, ^{
        [self->_bridge getRequiredPaymentActions:requestJson completion:^(NSString *result, NSError *error) {
            if (error) {
                reject(@"PAY_ERROR", error.localizedDescription, error);
            } else {
                resolve(result);
            }
        }];
    });
}

/**
 * Confirm a payment with signatures
 * @param requestJson JSON request string
 * @param resolve Promise resolve callback
 * @param reject Promise reject callback
 */
RCT_EXPORT_METHOD(confirmPayment:(NSString *)requestJson
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(_queue, ^{
        [self->_bridge confirmPayment:requestJson completion:^(NSString *result, NSError *error) {
            if (error) {
                reject(@"PAY_ERROR", error.localizedDescription, error);
            } else {
                resolve(result);
            }
        }];
    });
}

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

// Don't compile this code when we build for the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNWalletConnectPaySpecJSI>(params);
}
#endif

@end
