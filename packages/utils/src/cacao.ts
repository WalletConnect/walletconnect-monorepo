/* eslint-disable no-console */
import { AuthTypes } from "@walletconnect/types";
import { getCommonValuesInArrays } from "./misc";
const didPrefix = "did:pkh:";
export const getDidAddressSegments = (iss: string) => {
  return iss?.split(":");
};

export const getDidChainId = (iss: string) => {
  const segments = iss && getDidAddressSegments(iss);
  if (segments) {
    return iss.includes(didPrefix) ? segments[3] : segments[1];
  }
  return undefined;
};

export const getNamespacedDidChainId = (iss: string) => {
  const segments = iss && getDidAddressSegments(iss);
  if (segments) {
    return segments[2] + ":" + segments[3];
  }
  return undefined;
};

export const getDidAddress = (iss: string) => {
  const segments = iss && getDidAddressSegments(iss);
  if (segments) {
    return segments.pop();
  }
  return undefined;
};

export const formatMessage = (cacao: AuthTypes.FormatMessageParams, iss: string) => {
  const header = `${cacao.domain} wants you to sign in with your Ethereum account:`;
  const walletAddress = getDidAddress(iss);

  if (!cacao.aud && !cacao.uri) {
    throw new Error("Either `aud` or `uri` is required to construct the message");
  }

  let statement = cacao.statement || undefined;
  const uri = `URI: ${cacao.aud || cacao.uri}`;
  const version = `Version: ${cacao.version}`;
  const chainId = `Chain ID: ${getDidChainId(iss)}`;
  const nonce = `Nonce: ${cacao.nonce}`;
  const issuedAt = `Issued At: ${cacao.iat}`;
  const resources = cacao.resources
    ? `Resources:${cacao.resources.map((resource) => `\n- ${resource}`).join("")}`
    : undefined;

  if (cacao.resources && cacao.resources.length) {
    const recapStatemets: string[] = [];
    let totalUniqueAbilities = 1;
    cacao.resources.forEach((resource) => {
      if (resource.includes("urn:recap:")) {
        // console.log("urn:recap:", resource);
        const decoded = decodeRecap(resource);
        console.log("decoded", decoded);
        const recap = formatStatementFromRecap(decoded, totalUniqueAbilities);
        console.log("recap statement", recap);
        recapStatemets.push(recap.statement);
        totalUniqueAbilities += recap.numUniqueAbilities;
        console.log("totalUniqueAbilities", totalUniqueAbilities);
      }
    });
    if (recapStatemets.length > 0) {
      const base =
        "I further authorize the stated URI to perform the following actions on my behalf: ";
      const recapStatement = `${base}${recapStatemets.join(" ")}`;
      // add a space if there is a statement
      statement = `${statement ? statement + " " : ""}${recapStatement}`;
    }
  }

  const message = [
    header,
    walletAddress,
    ``,
    statement,
    ``,
    uri,
    version,
    chainId,
    nonce,
    issuedAt,
    resources,
  ]
    .filter((val) => val !== undefined && val !== null) // remove unnecessary empty lines
    .join("\n");

  return message;
};

export function buildAuthObject(
  requestPayload: AuthTypes.PayloadParams,
  signature: AuthTypes.CacaoSignature,
  iss: string,
) {
  if (!iss.includes("did:pkh:")) {
    iss = `did:pkh:${iss}`;
  }
  const chainId = getNamespacedDidChainId(iss);

  console.log("buildAuthObject", {
    requestPayload,
    signature,
    iss,
    chainId,
  });
  const authObject: AuthTypes.Cacao = {
    h: {
      t: "caip122",
    },
    p: {
      iss,
      domain: requestPayload.domain,
      aud: requestPayload.aud,
      version: requestPayload.version,
      nonce: requestPayload.nonce,
      iat: requestPayload.iat,
      statement: requestPayload.statement,
      requestId: requestPayload.requestId,
      resources: requestPayload.resources,
      nbf: requestPayload.nbf,
      exp: requestPayload.exp,
    },
    s: signature,
  };
  console.log("authObject", authObject);
  return authObject;
}
type PopulateAuthPayloadParams = {
  authPayload: AuthTypes.PayloadParams;
  chains: string[];
  methods: string[];
};
export function populateAuthPayload(params: PopulateAuthPayloadParams): AuthTypes.PayloadParams {
  const { authPayload, chains, methods } = params;

  if (!chains?.length) return authPayload;

  const requested = authPayload.chains;
  const supported = chains;

  const supportedChains = getCommonValuesInArrays(requested, supported) as string[];
  if (!supportedChains?.length) {
    throw new Error("No supported chains");
  }

  const requestedRecaps = getDecodedRecapsFromResources(authPayload.resources);

  const recaps = requestedRecaps.map((recap) => {
    isValidRecap(recap);
    const resource = getRecapResource(recap, "eip155");
    console.log("resource", resource);
    if (!resource?.length) return recap;
    const actions = getReCapActions(resource);
    const supportedActions = getCommonValuesInArrays(actions, methods);
    if (!supportedActions?.length) {
      throw new Error(
        `Supported methods don't satisfy the requested: ${JSON.stringify(
          actions,
        )}, supported: ${JSON.stringify(methods)}`,
      );
    }
    const formattedActions = assignAbilityToActions("request", supportedActions as string[], {
      chains: supportedChains,
    });
    const updatedRecap = addResourceToRecap(recap, "eip155", formattedActions);
    console.log("updatedRecap", updatedRecap);
    return updatedRecap;
  });

  // remove all recaps from resources
  const filteredRecaps =
    authPayload?.resources?.filter((resource) => !resource.includes("urn:recap:")) || [];
  // encode the new recaps and add to resources
  const encodedRecaps = recaps.map((recap) => encodeRecap(recap));

  console.log("filteredRecaps", filteredRecaps);
  console.log("encodedRecaps", encodedRecaps);
  const updatedResources = [...filteredRecaps, ...encodedRecaps];
  return {
    ...authPayload,
    chains: supportedChains,
    resources: authPayload?.resources || updatedResources.length > 0 ? updatedResources : undefined,
  };
}

export function getDecodedRecapsFromResources(resources?: string[]) {
  if (!resources) return [];
  return resources
    .filter((resource) => resource.includes("urn:recap:"))
    .map((resource) => decodeRecap(resource));
}

export function recapHasResource(recap: any, resource: string) {
  return recap?.att?.hasOwnProperty(resource);
}

export function getRecapResource(recap: any, resource: string): any[] {
  return recap?.att?.[resource] ? Object.keys(recap?.att?.[resource]) : [];
}

export function getRecapAbilitiesFromResource(actions: any[]) {
  return actions?.map((action) => Object.keys(action)) || [];
}

export function getReCapActions(abilities: any[]) {
  return abilities?.map((ability) => ability.split("/")?.[1]) || [];
}

export function base64Encode(input: unknown): string {
  return Buffer.from(JSON.stringify(input)).toString("base64");
}

export function base64Decode(encodedString: string): string {
  return JSON.parse(Buffer.from(encodedString, "base64").toString("utf-8"));
}

export function isValidRecap(recap: any) {
  if (!recap) throw new Error("No recap provided, value is undefined");
  if (!recap.att) throw new Error("No `att` property found");
  const resources = Object.keys(recap.att);
  if (!resources?.length) throw new Error("No resources found in `att` property");
  resources.forEach((resource) => {
    const resourceAbilities = recap.att[resource];
    console.log("resourceAbilities", resourceAbilities);
    if (Array.isArray(resourceAbilities))
      throw new Error(`Resource must be an object: ${resource}`);
    if (typeof resourceAbilities !== "object")
      throw new Error(`Resource must be an object: ${resource}`);
    if (!Object.keys(resourceAbilities).length)
      throw new Error(`Resource object is empty: ${resource}`);

    Object.keys(resourceAbilities).forEach((ability) => {
      const limits = resourceAbilities[ability];
      if (!Array.isArray(limits))
        throw new Error(`Ability limits ${ability} must be an array of objects, found: ${limits}`);
      if (!limits.length)
        throw new Error(`Value of ${ability} is empty array, must be an array with objects`);
      limits.forEach((limit) => {
        if (typeof limit !== "object")
          throw new Error(
            `Ability limits (${ability}) must be an array of objects, found: ${limit}`,
          );
      });
    });
  });
}

export function createRecap(resource: string, ability: string, actions: string[], limits = {}) {
  actions?.sort((a, b) => a.localeCompare(b));
  return {
    att: { [resource]: assignAbilityToActions(ability, actions, limits) },
  };
}

type RecapType = {
  att: {
    [key: string]: Record<string, unknown>;
  };
};
export function addResourceToRecap(recap: RecapType, resource: string, actions: unknown[]) {
  recap.att[resource] = {
    ...actions,
  };
  const keys = Object.keys(recap.att)?.sort();
  const sorted = keys.reduce(
    (obj, key) => {
      obj.att[key] = recap.att[key];
      return obj;
    },
    { att: {} },
  );
  return sorted;
}

export function assignAbilityToActions(ability: string, actions: string[], limits = {}) {
  // sort resources alphabetically
  actions = actions?.sort((a, b) => a.localeCompare(b));
  const abilities = actions.map((action) => {
    return {
      [`${ability}/${action}`]: [limits],
    };
  });
  return Object.assign({}, ...abilities);
}

export function encodeRecap(recap: any) {
  isValidRecap(recap);
  return `urn:recap:${base64Encode(recap)}`;
}

export function decodeRecap(recap: any): RecapType {
  const decoded = base64Decode(recap.replace("urn:recap:", ""));
  isValidRecap(decoded);
  return decoded as unknown as RecapType;
}

export function createEncodedRecap(resource: string, ability: string, actions: string[]): string {
  const recap = createRecap(resource, ability, actions);
  console.log("formatRecapFromNamespaces", recap);
  return encodeRecap(recap);
}

export function formatStatementFromRecap(recap: RecapType, startCounter: number) {
  isValidRecap(recap);
  const statementForRecap: string[] = [];
  let numUniqueAbilities = 0;
  console.log("recap for statement", recap);
  Object.keys(recap.att).forEach((resource) => {
    const actions = Object.keys(recap.att[resource]).map((ability: any) => {
      return {
        ability: ability.split("/")[0],
        action: ability.split("/")[1],
      };
    });
    //
    actions.sort((a, b) => a.action.localeCompare(b.action));
    const uniqueAbilities = {};
    actions.forEach((action: any) => {
      if (!uniqueAbilities[action.ability]) {
        uniqueAbilities[action.ability] = [];
      }
      uniqueAbilities[action.ability].push(action.action);
    });
    numUniqueAbilities += Object.keys(uniqueAbilities).length;
    const abilities = Object.keys(uniqueAbilities).map((ability, i) => {
      const counter = i + startCounter;
      return `(${counter}) '${ability}': '${uniqueAbilities[ability].join(
        "', '",
      )}' for '${resource}'.`;
    });
    statementForRecap.push(abilities.join(", "));
  });

  return {
    numUniqueAbilities,
    statement: statementForRecap.join(" "),
  };
}

export function getMethodsFromRecap(recap: string) {
  const decoded = decodeRecap(recap);
  console.log("getMethods decoded", decoded);
  isValidRecap(decoded);
  // methods are only available for eip155 as per the current implementation
  const resource = decoded.att?.eip155;
  if (!resource) return [];
  return Object.keys(resource).map((ability: any) => ability.split("/")[1]);
}

export function getChainsFromRecap(recap: string) {
  const decoded = decodeRecap(recap);
  isValidRecap(decoded);
  const chains: string[] = [];

  Object.values(decoded.att).forEach((resource: any) => {
    console.log("namespace", resource);
    Object.values(resource).forEach((ability: any) => {
      console.log("ability", ability);
      if (ability?.[0]?.chains) {
        chains.push(ability[0].chains);
      }
    });
  });
  return [...new Set(chains.flat())];
}
