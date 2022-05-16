interface ChainIdParams {
  namespace: string;
  reference: string;
}

interface AccountIdParams extends ChainIdParams {
  address: string;
}

const CAIP_DELIMITER = ":";

export function parseChainId(chain: string): ChainIdParams {
  const [namespace, reference] = chain.split(CAIP_DELIMITER);
  return { namespace, reference };
}

export function formatChainId(params: ChainIdParams): string {
  const { namespace, reference } = params;
  return [namespace, reference].join(CAIP_DELIMITER);
}

export function parseAccountId(account: string): AccountIdParams {
  const [namespace, reference, address] = account.split(CAIP_DELIMITER);
  return { namespace, reference, address };
}

export function formatAccountId(params: AccountIdParams): string {
  const { namespace, reference, address } = params;
  return [namespace, reference, address].join(CAIP_DELIMITER);
}

export function getUniqueValues(array: string[], parser: (str: string) => string): string[] {
  const unique: string[] = [];
  array.forEach(str => {
    const value = parser(str);
    if (!unique.includes(value)) unique.push(value);
  });
  return unique;
}

export function getAddressFromAccount(account: string) {
  const { address } = parseAccountId(account);
  return address;
}

export function getChainFromAccount(account: string) {
  const { namespace, reference } = parseAccountId(account);
  const chain = formatChainId({ namespace, reference });
  return chain;
}

export function formatAccountWithChain(address: string, chain: string) {
  const { namespace, reference } = parseChainId(chain);
  const account = formatAccountId({ namespace, reference, address });
  return account;
}

export function getAddresses(accounts: string[]) {
  return getUniqueValues(accounts, getAddressFromAccount);
}

export function getChains(accounts: string[]) {
  return getUniqueValues(accounts, getChainFromAccount);
}
