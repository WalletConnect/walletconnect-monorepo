/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle");

module.exports = {
  solidity: "0.7.3",
  networks: {
    hardhat: {
      accounts: [{"privateKey":"0x555e3f672b1e734e75bddf3b308aa1c42ef6720edb428c3b14f28753b26722ea","balance":"1000000000000000000000"},{"privateKey":"0x6df31934158c7ccfc3e41dc7e7f10f54ad80d794266277bbb5791728bcd3f122","balance":"1000000000000000000000"},{"privateKey":"0xc6439ac785bae8fc7bd07d5878aa3de2173df129d634e0005c4a482475b3905b","balance":"1000000000000000000000"},{"privateKey":"0x9a5c9cbb6e82ffdd058c9d9b8afeeb86dfb121c745eede25aa9a13f41dd163ca","balance":"1000000000000000000000"},{"privateKey":"0xc24bc08735fc3d4d681ed195b77daf4a265454567558d9bd543a931c8839b304","balance":"1000000000000000000000"},{"privateKey":"0xab2b872abe579130553783a9c5391035f2ae090b824932633f2625f7bb6cc6ed","balance":"1000000000000000000000"},{"privateKey":"0x7900d3d22195fda3fca045760f26bc1c136b452f3abbc366f93c656eea1ca9ce","balance":"1000000000000000000000"},{"privateKey":"0xc7e56852773a5c0f10fa42049f4f584d4860a523e22eeaf9b768bc0ef8f4082c","balance":"1000000000000000000000"},{"privateKey":"0xae70b1b4675328ebfdf4f59b3cf9206e6ea50ffa537831054fda57204b35cf23","balance":"1000000000000000000000"},{"privateKey":"0x5b73dbb94804550f1ae76947a016797181d06a9edfcba7f87a6274447456920c","balance":"1000000000000000000000"}]
    },
  },
  paths: {
    sources: './contracts',
    tests: './__tests__/contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
};