export type LanguageTranslation = {
  iso639_1: string;
  name: string;
  strings: string[];
};

export type ClientDetails = {
  type: string;
  token: string;
  peerName: string;
  language: string;
};
