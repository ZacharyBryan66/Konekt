import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployed = await deploy("ChainConfess", {
    from: deployer,
    log: true,
  });

  console.log(`ChainConfess deployed at: ${deployed.address}`);
};

export default func;
func.id = "deploy_chainconfess";
func.tags = ["ChainConfess"];



