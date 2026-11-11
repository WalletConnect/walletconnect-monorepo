# Consumer ProGuard/R8 rules, applied automatically to apps that minify
# (Expo SDK 58+ enables R8 for release builds by default).

# JNA backs the yttrium (WalletConnect Pay) uniffi bindings. It references
# desktop-only AWT classes that don't exist on Android, and it binds native
# functions, Structure fields and Callback methods by reflection.
-dontwarn java.awt.**
-keep class com.sun.jna.** { *; }
-keepclassmembers class * extends com.sun.jna.** { public *; }

# uniffi-generated Kotlin bindings, called from native code through JNA.
-keep class uniffi.** { *; }

# This module's own classes, which drive the bindings above.
-keep class com.walletconnect.reactnativemodule.** { *; }
