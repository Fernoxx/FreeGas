const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("FreeGasDaily", function () {
  let freeGasDaily;
  let owner;
  let user1;
  let user2;
  const claimAmount = ethers.parseEther("0.2");
  const initialFunding = ethers.parseEther("10");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const FreeGasDaily = await ethers.getContractFactory("FreeGasDaily");
    freeGasDaily = await FreeGasDaily.deploy({ value: initialFunding });
    await freeGasDaily.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await freeGasDaily.owner()).to.equal(owner.address);
    });

    it("Should set the correct claim amount", async function () {
      expect(await freeGasDaily.claimAmount()).to.equal(claimAmount);
    });

    it("Should not be paused initially", async function () {
      expect(await freeGasDaily.paused()).to.equal(false);
    });

    it("Should receive initial funding", async function () {
      expect(await ethers.provider.getBalance(await freeGasDaily.getAddress())).to.equal(initialFunding);
    });
  });

  describe("Claiming", function () {
    it("Should allow first claim", async function () {
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      const tx = await freeGasDaily.connect(user1).claim();
      const receipt = await tx.wait();
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      // Account for gas costs
      expect(balanceAfter).to.equal(balanceBefore + claimAmount - gasUsed);
      
      // Check last claim timestamp
      const lastClaim = await freeGasDaily.lastClaim(user1.address);
      expect(lastClaim).to.be.gt(0);
    });

    it("Should emit Claimed event", async function () {
      await expect(freeGasDaily.connect(user1).claim())
        .to.emit(freeGasDaily, "Claimed")
        .withArgs(user1.address, claimAmount, await time.latest() + 1);
    });

    it("Should not allow claiming twice in same day", async function () {
      await freeGasDaily.connect(user1).claim();
      
      await expect(freeGasDaily.connect(user1).claim())
        .to.be.revertedWith("already claimed today");
    });

    it("Should allow claiming after 24 hours", async function () {
      await freeGasDaily.connect(user1).claim();
      
      // Fast forward 24 hours + 1 second
      await time.increase(24 * 60 * 60 + 1);
      
      // Should be able to claim again
      await expect(freeGasDaily.connect(user1).claim())
        .to.not.be.reverted;
    });

    it("Should allow multiple users to claim", async function () {
      await expect(freeGasDaily.connect(user1).claim()).to.not.be.reverted;
      await expect(freeGasDaily.connect(user2).claim()).to.not.be.reverted;
    });

    it("Should fail when contract has insufficient balance", async function () {
      // Deploy new contract with minimal funding
      const FreeGasDaily = await ethers.getContractFactory("FreeGasDaily");
      const minimalContract = await FreeGasDaily.deploy({ value: ethers.parseEther("0.1") });
      await minimalContract.waitForDeployment();
      
      await expect(minimalContract.connect(user1).claim())
        .to.be.revertedWith("insufficient contract balance");
    });

    it("Should not allow claiming when paused", async function () {
      await freeGasDaily.setPaused(true);
      
      await expect(freeGasDaily.connect(user1).claim())
        .to.be.revertedWith("paused");
    });
  });

  describe("Owner functions", function () {
    it("Should allow owner to pause/unpause", async function () {
      await freeGasDaily.setPaused(true);
      expect(await freeGasDaily.paused()).to.equal(true);
      
      await freeGasDaily.setPaused(false);
      expect(await freeGasDaily.paused()).to.equal(false);
    });

    it("Should emit Paused event", async function () {
      await expect(freeGasDaily.setPaused(true))
        .to.emit(freeGasDaily, "Paused")
        .withArgs(true);
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(freeGasDaily.connect(user1).setPaused(true))
        .to.be.revertedWith("not owner");
    });

    it("Should allow owner to change claim amount", async function () {
      const newAmount = ethers.parseEther("0.5");
      await freeGasDaily.setClaimAmount(newAmount);
      expect(await freeGasDaily.claimAmount()).to.equal(newAmount);
    });

    it("Should emit ClaimAmountChanged event", async function () {
      const newAmount = ethers.parseEther("0.5");
      await expect(freeGasDaily.setClaimAmount(newAmount))
        .to.emit(freeGasDaily, "ClaimAmountChanged")
        .withArgs(newAmount);
    });

    it("Should not allow non-owner to change claim amount", async function () {
      await expect(freeGasDaily.connect(user1).setClaimAmount(ethers.parseEther("0.5")))
        .to.be.revertedWith("not owner");
    });

    it("Should allow owner to transfer ownership", async function () {
      await freeGasDaily.transferOwnership(user1.address);
      expect(await freeGasDaily.owner()).to.equal(user1.address);
    });

    it("Should emit OwnerChanged event", async function () {
      await expect(freeGasDaily.transferOwnership(user1.address))
        .to.emit(freeGasDaily, "OwnerChanged")
        .withArgs(user1.address);
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(freeGasDaily.connect(user1).transferOwnership(user2.address))
        .to.be.revertedWith("not owner");
    });
  });

  describe("Receive function", function () {
    it("Should accept CELO deposits", async function () {
      const depositAmount = ethers.parseEther("5");
      const balanceBefore = await ethers.provider.getBalance(await freeGasDaily.getAddress());
      
      await owner.sendTransaction({
        to: await freeGasDaily.getAddress(),
        value: depositAmount
      });
      
      const balanceAfter = await ethers.provider.getBalance(await freeGasDaily.getAddress());
      expect(balanceAfter).to.equal(balanceBefore + depositAmount);
    });
  });

  describe("Edge cases", function () {
    it("Should handle exact 24 hour timing", async function () {
      await freeGasDaily.connect(user1).claim();
      
      // Fast forward exactly 24 hours
      await time.increase(24 * 60 * 60);
      
      // Should still be blocked (need > 24 hours, not >=)
      await expect(freeGasDaily.connect(user1).claim())
        .to.be.revertedWith("already claimed today");
      
      // One second more should work
      await time.increase(1);
      await expect(freeGasDaily.connect(user1).claim())
        .to.not.be.reverted;
    });

    it("Should handle multiple claims over several days", async function () {
      // Day 1
      await freeGasDaily.connect(user1).claim();
      
      // Day 2
      await time.increase(24 * 60 * 60 + 1);
      await freeGasDaily.connect(user1).claim();
      
      // Day 3
      await time.increase(24 * 60 * 60 + 1);
      await freeGasDaily.connect(user1).claim();
      
      // Verify total claimed
      const contractBalance = await ethers.provider.getBalance(await freeGasDaily.getAddress());
      expect(contractBalance).to.equal(initialFunding - (claimAmount * 3n));
    });
  });
});