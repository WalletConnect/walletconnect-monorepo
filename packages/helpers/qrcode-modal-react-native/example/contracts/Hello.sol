// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

contract Hello {
  string defaultSuffix;
  constructor() {
    defaultSuffix = '!';
  }
  function sayHello(string memory name) public view returns(string memory) {
    return string(abi.encodePacked("Welcome to ", name, defaultSuffix));
  }
}