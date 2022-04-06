import { NewTypes } from "@walletconnect/types";

// -- uri -------------------------------------------------- //

export function formatUri(params: NewTypes.UriParameters) {
  const version = params.version;
  const relayProtocol = `?relay-protocol=${params.relayProtocol}`;
  const relayData = params.relayData ? `&relay-data=${params.relayData}` : "";
  const symKey = `&symKey=${params.symetricKey}`;

  return `wc:${params.topic}@${version}${relayProtocol}${relayData}${symKey}`;
}

export function parseUri(uri: string): NewTypes.UriParameters {
  const [protocolData, query] = uri.split("?");
  const topic = protocolData.split(":")[1].slice(0, -1);
  const variables = query.split("&");
  const params = {} as Omit<NewTypes.UriParameters, "topic">;
  variables.forEach(variable => {
    const [key, value] = variable.split("&");
    params[key] = value;
  });

  return { topic, ...params };
}
