import { AuthTypes } from "@walletconnect/types";
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

export const formatMessage = (cacao: AuthTypes.PayloadParams, iss: string) => {
  const header = `${cacao.domain} wants you to sign in with your Ethereum account:`;
  const walletAddress = getDidAddress(iss);
  let statement = cacao.statement || "";
  const uri = `URI: ${cacao.aud}`;
  const version = `Version: ${cacao.version}`;
  const chainId = `Chain ID: ${getDidChainId(iss)}`;
  const nonce = `Nonce: ${cacao.nonce}`;
  const issuedAt = `Issued At: ${cacao.iat}`;
  const resources =
    cacao.resources && cacao.resources.length > 0
      ? `Resources:\n${cacao.resources.map((resource) => `- ${resource}`).join("\n")}`
      : undefined;

  if (cacao.resources && cacao.resources.length) {
    // console.log("resources", resources);

    cacao.resources.forEach((resource) => {
      if (resource.includes("urn:recap:")) {
        // console.log("urn:recap:", resource);
        const parsed = resource.replace("urn:recap:", "");
        const decoded = base64Decode(parsed);
        // console.log("decoded", decoded, JSON.parse(decoded));
        const recap = formatStatementFromRecap(JSON.parse(decoded));
        statement = statement.concat(`${statement ? " " : ""}${recap}`);
        // console.log("statement", recap);
      }
    });
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
      ...requestPayload,
      chainId,
      iss,
    },
    s: signature,
  };
  console.log("authObject", authObject);
  return authObject;
}

export function base64Encode(input: string): string {
  return Buffer.from(input).toString("base64");
}

export function base64Decode(encodedString: string): string {
  return Buffer.from(encodedString, "base64").toString("utf-8");
}

export function formatRecapFromNamespaces(
  namespace: string,
  ability: string,
  resources: string[],
): string {
  const recap = {
    att: {
      [namespace]: resources.map((resource) => {
        return {
          [`${ability}/${resource}`]: [],
        };
      }),
    },
  };
  console.log("recap", JSON.stringify(recap));

  return `urn:recap:${base64Encode(JSON.stringify(recap))}`;
}

export function formatStatementFromRecap(recap: any) {
  let base = "I further authorize the stated URI to perform the following actions: ";
  const namespace = Object.keys(recap.att)[0];
  const actions = recap.att[namespace]
    .map((ability: any) => Object.keys(ability)[0])
    .map((ability: any) => {
      return {
        ability: ability.split("/")[0],
        action: ability.split("/")[1],
      };
    });

  const uniqueAbilities = {};
  actions.forEach((action: any) => {
    if (!uniqueAbilities[action.ability]) {
      uniqueAbilities[action.ability] = [];
    }
    uniqueAbilities[action.ability].push(action.action);
  });

  const abilities = Object.keys(uniqueAbilities).map((ability, i) => {
    return `(${i}) '${ability}': '${uniqueAbilities[ability].join("', '")}' for '${namespace}'.`;
  });

  base = base.concat(abilities.join(", "));

  return base;
}

export function getMethodsFromRecap(recap: string) {
  const decoded = base64Decode(recap.replace("urn:recap:", ""));
  const parsed = JSON.parse(decoded);
  const namespace = Object.keys(parsed.att)[0];
  const methods = parsed.att[namespace]
    .map((ability: any) => Object.keys(ability)[0])
    .map((ability: any) => ability.split("/")[1]);
  return methods;
}
