import { ICore } from "@walletconnect/types";

export type coreStorageData = {
  storage?: any;
  histroy?: any;
  expirer?: any;
  keychain?: any;
  pairing?: any;
  session?: any;
};

/**
 * Stores any available storage data from the core
 * @param core
 * @returns
 */
export const createCoreBackup = async (core: ICore): Promise<coreStorageData> => {
  const data: coreStorageData = {
    histroy: core.history.records ? core.history.records : undefined,
    expirer: core.expirer.values ? core.expirer.values : undefined,
    keychain: core.crypto.keychain.keychain ? core.crypto.keychain.keychain : undefined,
    pairing: core.pairing.pairings ? core.pairing.pairings.getAll() : undefined,
  };
  return data;
};
