/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle");

module.exports = {
  solidity: "0.7.3",
  networks: {
    hardhat: {
      accounts: [{"privateKey":"0x5bfba5931aa115aaa8dd46217326d532818cac3df4ca048f0017318bbcf15022","balance":"1000000000000000000000"},{"privateKey":"0xc630600dd55504cf482906982e5b3198c386e55fdce0388e0f946587795711f2","balance":"1000000000000000000000"},{"privateKey":"0xee3fd7abce48e58c11c5a479b786d636b57bb435e601ecd85378cc0716d27e90","balance":"1000000000000000000000"},{"privateKey":"0xe42fb8e26a56ee3a52a501adf6ec00a66c085b08401c9398378e29c6e92ba934","balance":"1000000000000000000000"},{"privateKey":"0xa4c8ba317c84ef8f427808337718f783baa00eafa67d88d72e54f8e04c14d535","balance":"1000000000000000000000"},{"privateKey":"0xeeea4feb9ceb45e27c087aca5fd9be3d08538a9acb320b48b344c3f165e95968","balance":"1000000000000000000000"},{"privateKey":"0x9a25891e52756b461dd4e7af445bb3f52f0ba25573167863691f9cc4dc6fef0a","balance":"1000000000000000000000"},{"privateKey":"0xef9229d129ccb0242920ea4d564bf358c904fb0a6d8c89b3c771bf3fafa263f7","balance":"1000000000000000000000"},{"privateKey":"0xb75bd6642fa6e634fa8fc2ca0fdffabb1c20d48a3d3edd5ca59b240610fc3bf9","balance":"1000000000000000000000"},{"privateKey":"0xe9244cafb11df164bec4e63844e69da963025ad3528598706ad237afecdb08ac","balance":"1000000000000000000000"}]
    },
  },
  paths: {
    sources: './contracts',
    tests: './__tests__/contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
};