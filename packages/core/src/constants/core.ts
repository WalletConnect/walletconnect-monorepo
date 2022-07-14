export const CORE_PROTOCOL = "wc";
export const CORE_VERSION = 2;
export const CORE_CONTEXT = "core";

export const CORE_STORAGE_PREFIX = `${CORE_PROTOCOL}@${CORE_VERSION}:${CORE_CONTEXT}:`;

export const CORE_DEFAULT = {
  name: CORE_CONTEXT,
  logger: "error",
};

export const CORE_STORAGE_OPTIONS = {
  database: ":memory:",
};

// FIXME: Always manually change this after each release (hardcoded from package.json)
// ... this will be temporarily hardcoded until we refactor our build chain!
export const CORE_SDK_VERSION = "2.0.0-beta.102";
