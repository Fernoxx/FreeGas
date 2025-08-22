const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.error("Please set CONTRACT_ADDRESS in your .env file");
    process.exit(1);
  }

  console.log("Interacting with FreeGasDaily at:", contractAddress);

  const FreeGasDaily = await hre.ethers.getContractFactory("FreeGasDaily");
  const freeGasDaily = FreeGasDaily.attach(contractAddress);

  const [signer] = await hre.ethers.getSigners();
  console.log("Using account:", signer.address);

  // Get contract info
  const owner = await freeGasDaily.owner();
  const claimAmount = await freeGasDaily.claimAmount();
  const paused = await freeGasDaily.paused();
  const contractBalance = await hre.ethers.provider.getBalance(contractAddress);

  console.log("\nContract Info:");
  console.log("- Owner:", owner);
  console.log("- Claim Amount:", hre.ethers.formatEther(claimAmount), "CELO");
  console.log("- Paused:", paused);
  console.log("- Contract Balance:", hre.ethers.formatEther(contractBalance), "CELO");

  // Check last claim time for the signer
  const lastClaim = await freeGasDaily.lastClaim(signer.address);
  const lastClaimDate = lastClaim > 0 ? new Date(Number(lastClaim) * 1000) : null;
  
  console.log("\nYour claim info:");
  console.log("- Last claim:", lastClaimDate ? lastClaimDate.toLocaleString() : "Never claimed");
  
  // Check if can claim
  const now = Math.floor(Date.now() / 1000);
  const oneDayInSeconds = 24 * 60 * 60;
  const canClaim = now > Number(lastClaim) + oneDayInSeconds;
  
  console.log("- Can claim now:", canClaim);
  
  if (canClaim && !paused && contractBalance >= claimAmount) {
    const nextClaimTime = new Date((Number(lastClaim) + oneDayInSeconds) * 1000);
    console.log("- Next claim available:", lastClaimDate ? nextClaimTime.toLocaleString() : "Now!");
  }

  // Example: Try to claim
  if (canClaim && !paused) {
    console.log("\nAttempting to claim...");
    try {
      const tx = await freeGasDaily.claim();
      console.log("Transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ Claim successful! Gas used:", receipt.gasUsed.toString());
      
      // Check the Claimed event
      const claimedEvent = receipt.logs.find(
        log => log.topics[0] === freeGasDaily.interface.getEvent("Claimed").topicHash
      );
      
      if (claimedEvent) {
        const decodedEvent = freeGasDaily.interface.parseLog(claimedEvent);
        console.log("Claimed amount:", hre.ethers.formatEther(decodedEvent.args.amount), "CELO");
      }
    } catch (error) {
      console.error("❌ Claim failed:", error.message);
    }
  }

  // Owner functions example (only if signer is owner)
  if (signer.address.toLowerCase() === owner.toLowerCase()) {
    console.log("\n=== Owner Functions ===");
    
    // Example: Check and top up contract balance if needed
    const minBalance = hre.ethers.parseEther("5"); // Minimum 5 CELO
    if (contractBalance < minBalance) {
      console.log("Contract balance low. Consider topping up.");
      
      // Example code to top up (commented out)
      // const topUpAmount = hre.ethers.parseEther("10");
      // const topUpTx = await signer.sendTransaction({
      //   to: contractAddress,
      //   value: topUpAmount
      // });
      // await topUpTx.wait();
      // console.log("✅ Topped up with", hre.ethers.formatEther(topUpAmount), "CELO");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});