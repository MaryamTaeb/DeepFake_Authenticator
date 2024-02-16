var Authenticator = artifacts.require("./Authenticator.sol");

module.exports = function(deployer) {
  deployer.deploy(Authenticator);
};