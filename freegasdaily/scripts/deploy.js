const hre = require("hardhat");

async function main() {
  console.log("Deploying FreeGasDaily contract...");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Get the account balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "CELO");

  // Deploy the contract
  const FreeGasDaily = await hre.ethers.getContractFactory("FreeGasDaily");
  
  // Deploy with initial funding (optional)
  const initialFunding = hre.ethers.parseEther("10"); // 10 CELO initial funding
  const freeGasDaily = await FreeGasDaily.deploy({ value: initialFunding });

  await freeGasDaily.waitForDeployment();

  const contractAddress = await freeGasDaily.getAddress();
  console.log("FreeGasDaily deployed to:", contractAddress);
  console.log("Contract funded with:", hre.ethers.formatEther(initialFunding), "CELO");

  // Get contract details
  const owner = await freeGasDaily.owner();
  const claimAmount = await freeGasDaily.claimAmount();
  const paused = await freeGasDaily.paused();

  console.log("\nContract Details:");
  console.log("- Owner:", owner);
  console.log("- Claim Amount:", hre.ethers.formatEther(claimAmount), "CELO");
  console.log("- Paused:", paused);
  console.log("- Contract Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(contractAddress)), "CELO");

  // Verify contract on Celoscan (if not on localhost)
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("\nWaiting for block confirmations...");
    await freeGasDaily.deploymentTransaction().wait(5);
    
    console.log("Verifying contract on Celoscan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  console.log("\n✅ Deployment complete!");
  console.log("\nTo interact with the contract:");
  console.log(`- Contract address: ${contractAddress}`);
  console.log(`- Network: ${hre.network.name}`);
  console.log("\nAdd this address to your .env file as CONTRACT_ADDRESS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});