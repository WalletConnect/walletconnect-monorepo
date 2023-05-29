const globals = {};
export const getGlobal = (key: string) => {
  return globals[key];
};

export const setGlobal = (key: string, value: unknown) => {
  globals[key] = value;
};
