#ifdef RCT_NEW_ARCH_ENABLED
#import "RNRNWalletConnectModuleSpec.h"

@interface RNWalletConnectPay : NSObject <NativeRNWalletConnectPaySpec>
#else
#import <React/RCTBridgeModule.h>

@interface RNWalletConnectPay : NSObject <RCTBridgeModule>
#endif

@end
