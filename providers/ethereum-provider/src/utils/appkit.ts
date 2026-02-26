export const getAppkit = async () => {
  const { createAppKit } = await import("@reown/appkit/core");
  return createAppKit;
};
