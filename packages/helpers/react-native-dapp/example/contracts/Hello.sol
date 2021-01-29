// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "hardhat/console.sol";

contract Hello {
  string defaultSuffix;
  constructor() {
    defaultSuffix = '!';
  }
  function sayHello(string memory name) public view returns(string memory) {
    console.log("Saying hello to %s!", msg.sender);
    return string(abi.encodePacked("Welcome to ", name, defaultSuffix));
  }
}