import { AuthTypes } from "@walletconnect/types";
import { getCommonValuesInArrays } from "./misc.js";
import { verifySignature } from "./signatures.js";
const didPrefix = "did:pkh:";
const NAMESPACE_DISPLAY_NAMES = {
  eip155: "Ethereum",
  solana: "Solana",
  bip122: "Bitcoin",
};

const getNamespaceNameFromNamespace = (namespace?: string) => {
  if (!namespace) return "";
  const displayName = NAMESPACE_DISPLAY_NAMES[namespace as keyof typeof NAMESPACE_DISPLAY_NAMES];
  return displayName || namespace;
};

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

export const getDidAddressNamespace = (iss: string) => {
  const segments = iss && getDidAddressSegments(iss);
  if (segments) {
    return iss.includes(didPrefix) ? segments[2] : segments[0];
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

export async function validateSignedCacao(params: { cacao: AuthTypes.Cacao; projectId?: string }) {
  const { cacao, projectId } = params;
  const { s: signature, p: payload } = cacao;
  const reconstructed = formatMessage(payload, payload.iss);
  const walletAddress = getDidAddress(payload.iss) as string;
  const isValid = await verifySignature(
    walletAddress,
    reconstructed,
    signature,
    getNamespacedDidChainId(payload.iss) as string,
    projectId as string,
  );

  return isValid;
}

export const formatMessage = (cacao: AuthTypes.FormatMessageParams, iss: string) => {
  const didNamespace = getDidAddressNamespace(iss);
  if (!didNamespace) {
    throw new Error("Invalid issuer: " + iss);
  }
  const header = `${cacao.domain} wants you to sign in with your ${getNamespaceNameFromNamespace(didNamespace)} account:`;
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
  const expirationTime = cacao.exp ? `Expiration Time: ${cacao.exp}` : undefined;
  const notBefore = cacao.nbf ? `Not Before: ${cacao.nbf}` : undefined;
  const requestId = cacao.requestId ? `Request ID: ${cacao.requestId}` : undefined;
  const resources = cacao.resources
    ? `Resources:${cacao.resources.map((resource) => `\n- ${resource}`).join("")}`
    : undefined;
  const recap = getRecapFromResources(cacao.resources);
  if (recap) {
    const decoded = decodeRecap(recap);
    statement = formatStatementFromRecap(statement, decoded);
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
    expirationTime,
    notBefore,
    requestId,
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
  return authObject;
}
type PopulateAuthPayloadParams = {
  authPayload: AuthTypes.PayloadParams;
  chains: string[];
  methods: string[];
};
export function populateAuthPayload(params: PopulateAuthPayloadParams): AuthTypes.PayloadParams {
  const { authPayload, chains, methods } = params;
  const statement = authPayload.statement || "";

  if (!chains?.length) return authPayload;

  const requested = authPayload.chains;
  const supported = chains;

  const supportedChains = getCommonValuesInArrays<string>(requested, supported);
  if (!supportedChains?.length) {
    throw new Error("No supported chains");
  }

  const requestedRecaps = getDecodedRecapFromResources(authPayload.resources);
  if (!requestedRecaps) return authPayload;

  isValidRecap(requestedRecaps);
  const resource = getRecapResource(requestedRecaps, "eip155");
  let updatedResources = authPayload?.resources || [];

  if (resource?.length) {
    const actions = getReCapActions(resource);
    const supportedActions = getCommonValuesInArrays<string>(actions, methods);
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
    const updatedRecap = addResourceToRecap(requestedRecaps, "eip155", formattedActions);
    // remove recap from resources as we will add the updated one
    updatedResources = authPayload?.resources?.slice(0, -1) || [];
    updatedResources.push(encodeRecap(updatedRecap));
  }

  return {
    ...authPayload,
    statement: buildRecapStatement(statement, getRecapFromResources(updatedResources)),
    chains: supportedChains,
    resources: authPayload?.resources || updatedResources.length > 0 ? updatedResources : undefined,
  };
}

export function getDecodedRecapFromResources(resources?: string[]) {
  const resource = getRecapFromResources(resources);
  if (!resource) return;
  if (!isRecap(resource)) return;
  return decodeRecap(resource);
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
  const keys = Object.keys(recap.att)?.sort((a, b) => a.localeCompare(b));
  const baseRecap: RecapType = { att: {} };
  const sorted = keys.reduce((obj, key) => {
    obj.att[key] = recap.att[key];
    return obj;
  }, baseRecap);
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
  // remove the padding from the base64 string as per recap spec
  return `urn:recap:${base64Encode(recap).replace(/=/g, "")}`;
}

export function decodeRecap(recap: any): RecapType {
  // base64Decode adds padding internally so don't need to add it back if it was removed
  const decoded = base64Decode(recap.replace("urn:recap:", ""));
  isValidRecap(decoded);
  return decoded as unknown as RecapType;
}

export function createEncodedRecap(resource: string, ability: string, actions: string[]): string {
  const recap = createRecap(resource, ability, actions);
  return encodeRecap(recap);
}

export function isRecap(resource: string) {
  return resource && resource.includes("urn:recap:");
}

export function mergeEncodedRecaps(recap1: string, recap2: string) {
  const decoded1 = decodeRecap(recap1);
  const decoded2 = decodeRecap(recap2);
  const merged = mergeRecaps(decoded1, decoded2);
  return encodeRecap(merged);
}

export function mergeRecaps(recap1: RecapType, recap2: RecapType) {
  isValidRecap(recap1);
  isValidRecap(recap2);
  const keys = Object.keys(recap1.att)
    .concat(Object.keys(recap2.att))
    .sort((a, b) => a.localeCompare(b));
  const mergedRecap: RecapType = { att: {} };
  keys.forEach((key) => {
    const actions = Object.keys(recap1.att?.[key] || {})
      .concat(Object.keys(recap2.att?.[key] || {}))
      .sort((a, b) => a.localeCompare(b));
    actions.forEach((action) => {
      mergedRecap.att[key] = {
        ...mergedRecap.att[key],
        [action]: recap1.att[key]?.[action] || recap2.att[key]?.[action],
      };
    });
  });
  return mergedRecap;
}

export function formatStatementFromRecap(statement = "", recap: RecapType) {
  isValidRecap(recap);
  const base = "I further authorize the stated URI to perform the following actions on my behalf: ";

  if (statement.includes(base)) return statement;

  const statementForRecap: string[] = [];
  let currentCounter = 0;
  Object.keys(recap.att).forEach((resource) => {
    const actions = Object.keys(recap.att[resource]).map((ability: any) => {
      return {
        ability: ability.split("/")[0],
        action: ability.split("/")[1],
      };
    });
    //
    actions.sort((a, b) => a.action.localeCompare(b.action));
    const uniqueAbilities: Record<string, string[]> = {};
    actions.forEach((action: any) => {
      if (!uniqueAbilities[action.ability]) {
        uniqueAbilities[action.ability] = [];
      }
      uniqueAbilities[action.ability].push(action.action);
    });
    const abilities = Object.keys(uniqueAbilities).map((ability) => {
      currentCounter++;
      return `(${currentCounter}) '${ability}': '${uniqueAbilities[ability].join(
        "', '",
      )}' for '${resource}'.`;
    });
    statementForRecap.push(abilities.join(", ").replace(".,", "."));
  });

  const recapStatemet = statementForRecap.join(" ");
  const recapStatement = `${base}${recapStatemet}`;
  // add a space if there is a statement
  return `${statement ? statement + " " : ""}${recapStatement}`;
}

export function getMethodsFromRecap(recap: string) {
  const decoded = decodeRecap(recap);
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
    Object.values(resource).forEach((ability: any) => {
      if (ability?.[0]?.chains) {
        chains.push(ability[0].chains);
      }
    });
  });
  return [...new Set(chains.flat())];
}

export function buildRecapStatement(statement: string, recap: unknown) {
  if (!recap) return statement;
  const decoded = decodeRecap(recap);
  isValidRecap(decoded);
  return formatStatementFromRecap(statement, decoded);
}

export function getRecapFromResources(resources?: string[]) {
  if (!resources) return;
  // per spec, recap is always the last resource
  const resource = resources?.[resources.length - 1];
  return isRecap(resource) ? resource : undefined;
}
