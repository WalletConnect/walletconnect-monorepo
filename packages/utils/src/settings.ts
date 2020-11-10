import { SettingTypes } from "@walletconnect/types";

export function generateCaip25ProposalSetting(params: {
  chains: string[];
  methods: string[];
}): SettingTypes.Proposal {
  return {
    state: {
      accounts: {
        params: {
          chains: params.chains,
        },
        writeAccess: {
          proposer: false,
          responder: true,
        },
      },
    },
    methods: params.methods,
  };
}

export function generateStatelessProposalSetting(params: {
  methods: string[];
}): SettingTypes.Proposal {
  return { state: {}, methods: params.methods };
}

export function generateSettledSetting<P = any, S = any>(
  params: SettingTypes.GenerateSettledParams<P, S>,
): SettingTypes.Settled<S> {
  const state: SettingTypes.StateSettled = {};
  for (const key of Object.keys(params.proposal.state)) {
    state[key] = {
      data: params.state[key],
      writeAccess: {
        [params.proposer.publicKey]: params.proposal.state[key].writeAccess.proposer,
        [params.responder.publicKey]: params.proposal.state[key].writeAccess.responder,
      },
    };
  }
  return { state, methods: params.proposal.methods };
}

export function handleSettledSettingStateUpdate<S = any>(
  params: SettingTypes.HandleSettledStateUpdateParams<S>,
): SettingTypes.StateSettled {
  const state: SettingTypes.StateSettled = params.settled.state;

  for (const key of Object.keys(state)) {
    if (!params.settled.state[key].writeAccess[params.participant.publicKey]) {
      throw new Error(`Unauthorized state update for key: ${key}`);
    }
    state[key].data = params.update[key].data;
  }

  return state;
}
