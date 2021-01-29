/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle");
require("dotenv/config");

const { HARDHAT_URL } = process.env;

module.exports = {
  solidity: "0.7.3",
  networks: {
    localhost: { url: HARDHAT_URL },
    hardhat: {
      accounts: [{"privateKey":"0x65e7fb84bcd847cf57c8a37d6a3fec7ed9d409ac060947578cc6c22367093e3a","balance":"1000000000000000000000"},{"privateKey":"0x95e5ca8328fdeb33af7230ebf197c539620a02150ffa808d0bae52ca3be15b8c","balance":"1000000000000000000000"},{"privateKey":"0x9f93a5fd787be1ba059d9733dad8b381b08f67569697a26c57963c0cf4da88c6","balance":"1000000000000000000000"},{"privateKey":"0x9ba787c4d14f0682236426fa00f2ebf6a2e9748c3f286a856fbc3a2090553c10","balance":"1000000000000000000000"},{"privateKey":"0x411361a34a1ec4a31e9ec38b88b9a08d753701fe2297f4dcc133f1c4aa80e104","balance":"1000000000000000000000"},{"privateKey":"0x86554c6a644c6a7146c6e1a297f7d1561497c025abf9627c05727d7e380b1e9b","balance":"1000000000000000000000"},{"privateKey":"0x157e58d8b05858499f9263f020847c835f071642aec3e99a99792870a1901fc1","balance":"1000000000000000000000"},{"privateKey":"0xf58474e8538ee51c9fbbe183f66fcf248d18b9e88d4e8d746c33dabffc774a8c","balance":"1000000000000000000000"},{"privateKey":"0xf805391e0994292208bbf211e0f9e580c029a54dcc0dc72d1a3ff0bb559da8f0","balance":"1000000000000000000000"},{"privateKey":"0x806e6ad419ceb47da409d1c66a36da78875451177506a77fadc329085e9e1edd","balance":"1000000000000000000000"}]
    },
  },
  paths: {
    sources: './contracts',
    tests: './__tests__/contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
};