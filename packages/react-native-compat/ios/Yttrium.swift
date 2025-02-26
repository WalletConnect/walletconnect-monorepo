import YttriumWrapper


@objc(Yttrium)
class Yttrium: NSObject {
    
    @objc
    func status(_ params: Any, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        print("checkStatus called with", params )
        if let dict = params as? [String: Any],
           let projectId = dict["projectId"] as? String,
           let orchestrationId = dict["orchestrationId"] as? String {
            let client = ChainAbstractionClient.init(projectId: projectId)
            Task {
                do {
                    let statusResponse = try await client.status(orchestrationId: orchestrationId)
                    
                    switch statusResponse {
                    case let .completed(statusResponseCompleted):
                        print("status response completed", statusResponseCompleted)
                        let responseDict: [String: Any] = [
                            "createdAt": statusResponseCompleted.createdAt,
                            "status": "completed"
                        ]
                        resolve(responseDict)
                    case let .error(statusResponseError):
                        print("status response error", statusResponseError)
                        let responseDict: [String: Any] = [
                            "createdAt": statusResponseError.createdAt,
                            "reason": statusResponseError.error,
                            "status": "error"
                        ]
                        resolve(responseDict)
                    case let .pending(statusResponsePending):
                        print("status response pending", statusResponsePending)
                        let responseDict: [String: Any] = [
                            "createdAt": statusResponsePending.createdAt,
                            "checkIn": statusResponsePending.checkIn,
                            "status": "pending"
                        ]
                        resolve(responseDict)
                    }
                } catch {
                    print("Error occurred: \(error)")
                    print(error)
                    reject("checkStatus err", "checkStatus", error)
                }
            }
        }
    }
    
    func convertRouteResponseAvailableToDictionary(_ routeResponse: RouteResponseAvailable) -> [String: Any] {
        func transactionToDictionary(_ transaction: YttriumWrapper.Transaction) -> [String: Any] {
            return [
                "chainId": transaction.chainId,
                "from": transaction.from,
                "to": transaction.to,
                "value": transaction.value,
                "input": transaction.input,
                "gasLimit": transaction.gasLimit,
                "nonce": transaction.nonce
            ]
        }

        func fundingMetadataToDictionary(_ metadata: YttriumWrapper.FundingMetadata) -> [String: Any] {
            return [
                "chainId": metadata.chainId,
                "tokenContract": metadata.tokenContract,
                "symbol": metadata.symbol,
                "amount": metadata.amount,
                "bridgingFee": metadata.bridgingFee,
                "decimals": metadata.decimals
            ]
        }

        func initialTransactionMetadataToDictionary(_ metadata: YttriumWrapper.InitialTransactionMetadata) -> [String: Any] {
            return [
                "transferTo": metadata.transferTo,
                "amount": metadata.amount,
                "tokenContract": metadata.tokenContract,
                "symbol": metadata.symbol,
                "decimals": metadata.decimals
            ]
        }

        func metadataToDictionary(_ metadata: YttriumWrapper.Metadata) -> [String: Any] {
            return [
                "fundingFrom": metadata.fundingFrom.map { fundingMetadataToDictionary($0) },
                "initialTransaction": initialTransactionMetadataToDictionary(metadata.initialTransaction),
                "checkIn": metadata.checkIn
            ]
        }

        return [
            "orchestrationId": routeResponse.orchestrationId,
            "initialTransaction": transactionToDictionary(routeResponse.initialTransaction),
            "transactions": routeResponse.transactions.map { transactionToDictionary($0) },
            "metadata": metadataToDictionary(routeResponse.metadata)
        ]
    }
    
    private var availableResponseDictionary: [String: RouteResponseAvailable] = [:]
    
    @objc
    func prepare(_ params: Any, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        print("checkRoute called with", params)
        let dict = params as? [String: Any]
        
        if let transactionData = dict?["transaction"] as? [String: String],
            let from = transactionData["from"] ?? "" as Optional,
            let chainId = transactionData["chainId"] ?? "" as Optional,
            let data = transactionData["data"] ?? "" as Optional,
            let value = transactionData["value"] ?? "" as Optional,
            let to = transactionData["to"] ?? "" as Optional,
            let projectId = dict?["projectId"] as? String {
            
            let client = ChainAbstractionClient.init(projectId: projectId)
            print("created client, checking route...")
            Task {
                do {
                    let transaction = InitialTransaction.init(chainId: chainId, from: from, to: to, value: value, input: data)
                    
                    let routeResponseSuccess = try await client.prepare(initialTransaction: transaction)
                    print("result", routeResponseSuccess)
                    
                    switch routeResponseSuccess {
                    case let .success(routeResponse):
                        switch routeResponse {
                        case let .available(availableResponse):
                            
                            availableResponseDictionary[availableResponse.orchestrationId] = availableResponse;
                            //                          let uiFields = try await client.getRouteUiFields(routeResponse: availableResponse, initialTransaction: Transaction(from: from, to: to, value: value, gas: gas, data: data, nonce: nonce, chainId: chainId, gasPrice: gasPrice, maxFeePerGas: maxFeePerGas, maxPriorityFeePerGas: maxPriorityFeePerGas), currency: Currency.usd)
                            //
                            //                          let routesDetails = convertRouteUiFieldsToDictionary(uiFields)
//                            print("available result", availableResponse)
                            //                          print("ui_fields_json", routesDetails)
                          let responseDict = convertRouteResponseAvailableToDictionary(availableResponse)
                            print("parsed result dictionary", responseDict)
                          resolve(["status": "available", "data": responseDict])
//                                                          "routesDetails": routesDetails
                            
                        case .notRequired(_):
                            print("not required")
                            resolve(["status": "not_required"])
                        }
                    case let .error(routeResponse):
                        switch routeResponse.error {
                        case BridgingError.insufficientFunds:
                            let responseDict: [String: Any] = [
                                "status": "error",
                                "reason": "insufficientFunds"
                            ]
                            resolve(responseDict)
                        case BridgingError.insufficientGasFunds:
                            let responseDict: [String: Any] = [
                                "status": "error",
                                "reason": "insufficientGasFunds"
                            ]
                            resolve(responseDict)
                        case BridgingError.noRoutesAvailable:
                            let responseDict: [String: Any] = [
                                "status": "error",
                                "reason": "noRoutesAvailable"
                            ]
                            resolve(responseDict)
                        }
                        print(routeResponse)
                        print(routeResponse.error)
                    }
                    //          resolve(result)
                } catch {
                    print("Error occurred: \(error)")
                    print(error)
                    reject("yttrium err", "yttrium_err", error)
                }
            }
        }
    }
    
    func convertUiFieldsToDictionary(_ uiFields: UiFields) -> [String: Any] {
        func feeEstimatedTransactionToDictionary(_ transaction: YttriumWrapper.FeeEstimatedTransaction) -> [String: Any] {
            return [
                "chainId": transaction.chainId,
                "from": transaction.from,
                "to": transaction.to,
                "value": transaction.value,
                "input": transaction.input,
                "gasLimit": transaction.gasLimit,
                "nonce": transaction.nonce,
                "maxFeePerGas": transaction.maxFeePerGas,
                "maxPriorityFeePerGas": transaction.maxPriorityFeePerGas
            ]
        }

        func amountToDictionary(_ amount: YttriumWrapper.Amount) -> [String: Any] {
            return [
                "symbol": amount.symbol,
                "amount": amount.amount,
                "unit": amount.unit,
                "formatted": amount.formatted,
                "formattedAlt": amount.formattedAlt
            ]
        }

        func transactionFeeToDictionary(_ fee: YttriumWrapper.TransactionFee) -> [String: Any] {
            return [
                "fee": amountToDictionary(fee.fee),
                "localFee": amountToDictionary(fee.localFee)
            ]
        }

        func txnDetailsToDictionary(_ txnDetails: YttriumWrapper.TxnDetails) -> [String: Any] {
            return [
                "transaction": feeEstimatedTransactionToDictionary(txnDetails.transaction),
                "fee": transactionFeeToDictionary(txnDetails.fee)
            ]
        }

        return [
            "route": uiFields.route.map { txnDetailsToDictionary($0) },
            "localRouteTotal": amountToDictionary(uiFields.localRouteTotal),
            "bridge": uiFields.bridge.map { transactionFeeToDictionary($0) },
            "localBridgeTotal": amountToDictionary(uiFields.localBridgeTotal),
            "initial": txnDetailsToDictionary(uiFields.initial),
            "localTotal": amountToDictionary(uiFields.localTotal)
        ]
    }
    
    @objc
    func getBridgeDetails(_ params: Any, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        print("getBridgeDetails called with", params)
        let dict = params as? [String: String]
        
        if  let orchestrationId = dict?["orchestrationId"] ?? "" as Optional,
            let projectId = dict?["projectId"] as? String {
            
            let client = ChainAbstractionClient.init(projectId: projectId)
            print("created client, getting UI fields...")
            Task {
                do {
                    
                    let availableResponse = availableResponseDictionary[orchestrationId]!
                    let uiFields = try await client.getUiFields(routeResponse: availableResponse, currency: Currency.usd)
                    let uiFIeldsDict = convertUiFieldsToDictionary(uiFields)
                    print("getBridgeDetails result", uiFields)
                    resolve(uiFIeldsDict)
                } catch {
                    print("Error occurred: \(error)")
                    print(error)
                    reject("yttrium err", "yttrium_err getBridgeDetails", error)
                }
            }
        }
    }
    
    @objc
    func getERC20Balance(_ params: Any, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        print("getERC20Balance called with", params)
        let dict = params as? [String: String]
        
        if  let tokenAddress = dict?["tokenAddress"] ?? "" as Optional,
            let ownerAddress = dict?["ownerAddress"] ?? "" as Optional,
            let chainId = dict?["chainId"] ?? "" as Optional,
            let projectId = dict?["projectId"] as? String {
            
            let client = ChainAbstractionClient.init(projectId: projectId)
            Task {
                do {
                    let balance = try await client.erc20TokenBalance(chainId: chainId, token: tokenAddress, owner: ownerAddress)
                    print("getERC20Balance result", balance)
                    resolve(balance)
                } catch {
                    print("Error occurred: \(error)")
                    print(error)
                    reject("yttrium err", "yttrium_err getERC20Balance", error)
                }
            }
        }
    }
    
    @objc
    func estimateFees(_ params: Any, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        print("getERC20Balance called with", params)
        let dict = params as? [String: String]
        
        if let chainId = dict?["chainId"] ?? "" as Optional,
            let projectId = dict?["projectId"] as? String {
            
            let client = ChainAbstractionClient.init(projectId: projectId)
            Task {
                do {
                    let fees = try await client.estimateFees(chainId: chainId)
                    print("estimateFees result", fees)
                    resolve(["maxFeePerGas": fees.maxFeePerGas, "maxPriorityFeePerGas": fees.maxPriorityFeePerGas])
                } catch {
                    print("Error occurred: \(error)")
                    print(error)
                    reject("yttrium err", "yttrium_err estimateFees", error)
                }
            }
        }
    }
    
}
