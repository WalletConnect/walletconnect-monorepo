
#ifdef RCT_NEW_ARCH_ENABLED
#import "RNRNWalletConnectModuleSpec.h"

@interface RNWalletConnectModule : NSObject <NativeRNWalletConnectModuleSpec>
#else
#import <React/RCTBridgeModule.h>

@interface RNWalletConnectModule : NSObject <RCTBridgeModule>
#endif

@end
