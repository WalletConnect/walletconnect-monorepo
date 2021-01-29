
const { expect } = require('chai');

describe("Hello", function() {
  it("Should return the default greeting", async function() {
    const Hello = await ethers.getContractFactory("Hello");
    const hello = await Hello.deploy();
    
    await hello.deployed();

    expect(await hello.sayHello("React Native")).to.equal("Welcome to React Native!");
    expect(await hello.sayHello("Web3")).to.equal("Welcome to Web3!");
  });
});
    