import { Caip25StateParams, SettingTypes } from "@walletconnect/types";

export function generateCaip25ProposalSetting(params: {
  chains: string[];
  methods: string[];
}): SettingTypes.Proposal<Caip25StateParams> {
  return {
    state: {
      params: {
        accounts: {
          chains: params.chains,
        },
      },
      writeAccess: {
        accounts: {
          proposer: false,
          responder: true,
        },
      },
    },
    jsonrpc: {
      methods: params.methods,
    },
  };
}

export function generateStatelessProposalSetting(params: {
  methods: string[];
}): SettingTypes.Proposal {
  return { state: { params: {}, writeAccess: {} }, jsonrpc: { methods: params.methods } };
}

export function generateSettledSetting<P = any, S = any>(
  params: SettingTypes.GenerateSettledParams<P, S>,
): SettingTypes.Settled<S> {
  const state: SettingTypes.StateSettled = {
    data: {},
    writeAccess: {},
  };
  for (const key of Object.keys(params.proposal.state)) {
    state.data[key] = params.state[key];
    state.writeAccess[key] = {
      [params.proposer.publicKey]: params.proposal.state.writeAccess[key].proposer,
      [params.responder.publicKey]: params.proposal.state.writeAccess[key].responder,
    };
  }
  return { state, jsonrpc: params.proposal.jsonrpc };
}

export function handleSettledSettingStateUpdate<S = any>(
  params: SettingTypes.HandleSettledStateUpdateParams<S>,
): SettingTypes.StateSettled {
  const state: SettingTypes.StateSettled = params.settled.state;

  for (const key of Object.keys(state)) {
    if (!params.settled.state.writeAccess[key][params.participant.publicKey]) {
      throw new Error(`Unauthorized state update for key: ${key}`);
    }
    state.data[key] = params.update[key];
  }

  return state;
}
