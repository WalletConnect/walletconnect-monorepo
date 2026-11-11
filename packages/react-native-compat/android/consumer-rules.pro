# Consumer ProGuard/R8 rules, applied automatically to apps that minify
# (Expo SDK 58+ enables R8 for release builds by default).

# JNA backs the yttrium (WalletConnect Pay) uniffi bindings. It references
# desktop-only AWT classes that don't exist on Android, and it binds native
# functions, Structure fields and Callback methods by reflection.
-dontwarn java.awt.**
-keep class com.sun.jna.** { *; }
-keepclassmembers class * extends com.sun.jna.** { public *; }

# yttrium-wcpay's uniffi-generated Kotlin bindings, called from native code
# through JNA. Scoped to yttrium's packages (not uniffi.**) so other uniffi
# libraries in the app can still be shrunk. If yttrium moves its bindings to
# a different package, update these rules to match.
-keep class uniffi.yttrium_wcpay.** { *; }
-keep class uniffi.uniffi_yttrium_wcpay.** { *; }

# This module's own classes, which drive the bindings above.
-keep class com.walletconnect.reactnativemodule.** { *; }
