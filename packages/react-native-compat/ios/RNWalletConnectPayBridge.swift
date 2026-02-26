import Foundation
import YttriumWrapper

@objc public class RNWalletConnectPayBridge: NSObject {
    private var client: WalletConnectPayJson?

    @objc public override init() {
        super.init()
    }

    @objc public func initialize(_ sdkConfig: String) throws {
        client = try WalletConnectPayJson(sdkConfig: sdkConfig)
    }

    @objc public func getPaymentOptions(
        _ requestJson: String,
        completion: @escaping (String?, Error?) -> Void
    ) {
        guard let client = client else {
            completion(nil, NSError(domain: "RNWalletConnectPay", code: 1, userInfo: [NSLocalizedDescriptionKey: "Pay client not initialized"]))
            return
        }

        Task {
            do {
                let result = try await client.getPaymentOptions(requestJson: requestJson)
                completion(result, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc public func getRequiredPaymentActions(
        _ requestJson: String,
        completion: @escaping (String?, Error?) -> Void
    ) {
        guard let client = client else {
            completion(nil, NSError(domain: "RNWalletConnectPay", code: 1, userInfo: [NSLocalizedDescriptionKey: "Pay client not initialized"]))
            return
        }

        Task {
            do {
                let result = try await client.getRequiredPaymentActions(requestJson: requestJson)
                completion(result, nil)
            } catch {
                completion(nil, error)
            }
        }
    }

    @objc public func confirmPayment(
        _ requestJson: String,
        completion: @escaping (String?, Error?) -> Void
    ) {
        guard let client = client else {
            completion(nil, NSError(domain: "RNWalletConnectPay", code: 1, userInfo: [NSLocalizedDescriptionKey: "Pay client not initialized"]))
            return
        }

        Task {
            do {
                let result = try await client.confirmPayment(requestJson: requestJson)
                completion(result, nil)
            } catch {
                completion(nil, error)
            }
        }
    }
}
