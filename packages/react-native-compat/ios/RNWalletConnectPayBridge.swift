import Foundation

@objc public class RNWalletConnectPayBridge: NSObject {
    @objc public override init() {
        super.init()
    }

    @objc public func initialize(_ sdkConfig: String) throws {
        throw NSError(
            domain: "RNWalletConnectPay",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "RNWalletConnectPayBridge is disabled because YttriumWrapper is not enabled"]
        )
    }

    @objc public func getPaymentOptions(
        _ requestJson: String,
        completion: @escaping (String?, Error?) -> Void
    ) {
        completion(nil, NSError(
            domain: "RNWalletConnectPay",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "RNWalletConnectPayBridge is disabled because YttriumWrapper is not enabled"]
        ))
    }

    @objc public func getRequiredPaymentActions(
        _ requestJson: String,
        completion: @escaping (String?, Error?) -> Void
    ) {
        completion(nil, NSError(
            domain: "RNWalletConnectPay",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "RNWalletConnectPayBridge is disabled because YttriumWrapper is not enabled"]
        ))
    }

    @objc public func confirmPayment(
        _ requestJson: String,
        completion: @escaping (String?, Error?) -> Void
    ) {
        completion(nil, NSError(
            domain: "RNWalletConnectPay",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "RNWalletConnectPayBridge is disabled because YttriumWrapper is not enabled"]
        ))
    }
}
