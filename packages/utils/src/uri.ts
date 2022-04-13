import { EngineTypes } from "@walletconnect/types";

export function formatUri(params: EngineTypes.UriParameters) {
  const relayProtocol = `?relay-protocol=${params.relay.protocol}`;
  const relayData = params.relay.data ? `&relay-data=${params.relay.data}` : "";
  const symKey = `&symKey=${params.symKey}`;

  return `wc:${params.topic}@2${relayProtocol}${relayData}${symKey}`;
}

export function parseUri(uri: string): EngineTypes.UriParameters {
  const [protocolData, query] = uri.split("?");
  const topic = protocolData.split(":")[1].slice(0, -1);
  const variables = query.split("&");
  const params = {} as Omit<EngineTypes.UriParameters, "topic">;
  variables.forEach(variable => {
    const [key, value] = variable.split("&");
    params[key] = value;
  });

  return { topic, ...params };
}
