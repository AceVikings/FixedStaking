const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { advanceTime } = require('./utils');
const Web3 = require("web3");
const { fromWei } = Web3.utils;

describe('Locked Staking Test Suite', async function(){
    let owner, alice, bob, token, rToken, staking;
    beforeEach('Running Iterative Functions', async function(){

        [owner, alice, bob] = await ethers.getSigners();
        const testCoin = await ethers.getContractFactory('Token');
        token = await testCoin.deploy();
        const rewardToken = await ethers.getContractFactory('RewardToken');
        rToken = await rewardToken.deploy();
        const stake = await ethers.getContractFactory('LockedStaking');
        staking = await stake.deploy(token.address, rToken.address);

        await token.connect(alice).approve(staking.address, ethers.utils.parseEther('10000'));
        await token.connect(bob).approve(staking.address, ethers.utils.parseEther('10000'));

        await token.connect(alice).mintTestTokens(1000);
        await token.connect(bob).mintTestTokens(1000);

        await rToken.mintTestTokens(10000);
        await rToken.transfer(staking.address, ethers.utils.parseEther('1000'));

    });

    it('Test 1: Staking Tokens', async function(){
        await staking.connect(alice).stake([ethers.utils.parseEther('25'),
            ethers.utils.parseEther('35')], [0, 1]);
        let stakedBalance = await token.balanceOf(staking.address);
        console.log("Staked Token by Alice :- ", fromWei(stakedBalance.toString(),'ether'));
        expect (await staking.stakedIds(alice.address, 1)).to.equal(2);
        console.log("Staked Ids shown accurately");
        let amount1 = BigNumber.from((await staking.userStaked(alice.address, 1)).amount).toString();
        console.log("Amount stored in struct for first deposit in first batch:-",
            fromWei(amount1.toString(),'ether'));
        let amount2 = BigNumber.from((await staking.userStaked(alice.address, 2)).amount).toString();
        console.log("Amount stored in struct for second deposit in first batch:-",
            fromWei(amount2.toString(),'ether'));
    });

    it('Test 2: User(s) claiming Rewards and checking APR rates', async function(){
        await staking.connect(alice).stake([ethers.utils.parseEther('25'),
            ethers.utils.parseEther('35')], [0, 1]);
        await staking.connect(bob).stake([ethers.utils.parseEther('55')], [2]);
        let balanceBefore = await rToken.balanceOf(bob.address);
        console.log("Bob's Reward Token Balance before claiming Reward:-",
            fromWei(balanceBefore.toString(),'ether'));
        await (advanceTime(360* 3600 * 24));
        const rewards = await staking.getReward(bob.address, 1);
        console.log("Get Rewards View Function:-", fromWei(rewards.toString(),'ether'));
        await staking.connect(bob).claimReward([1]);
        let balanceAfter = await rToken.balanceOf(bob.address);
        console.log("Bob's reward Token Balance after claiming Reward:-",
        fromWei(balanceAfter.toString(),'ether'));
    });

    it('Test 3: Unstaking and Forced Unstaking and checking Slashed Amount', async function(){
        await staking.connect(alice).stake([ethers.utils.parseEther('25'),
            ethers.utils.parseEther('35')], [0, 1]);
        await staking.connect(bob).stake([ethers.utils.parseEther('55'),
            ethers.utils.parseEther('15')], [1, 2]);
        await (advanceTime(60 * 3600 * 24));
        await expect(staking.connect(alice).unstake([1,2])).to.be.revertedWith('Not unlocked yet');
        console.log("Successfully stopped Unstaked before stipulated time");
        await (advanceTime(60 * 3600 * 24));
        let balanceBefore = await token.balanceOf(alice.address);
        console.log("Alice's Token Balance before Unstaking:-", fromWei(balanceBefore.toString(),'ether'));
        let balanceBefore2 = await rToken.balanceOf(alice.address);
        console.log("Alice's Reward Balance before Unstaking:-", fromWei(balanceBefore2.toString(),'ether'));
        await staking.connect(alice).unstake([1]);
        let balanceAfter = await token.balanceOf(alice.address);
        console.log("Alice's Token Balance after Unstaking first ID:-", fromWei(balanceAfter.toString(),'ether'));
        let balanceAfter2 = await rToken.balanceOf(alice.address);
        console.log("Alice's Reward Token Balance after Unstaking first ID:-", fromWei(balanceAfter2.toString(),'ether'));
        await (advanceTime(60 * 3600 * 24));
        await staking.connect(alice).unstake([2]);
        let balanceAfter3 = await token.balanceOf(alice.address);
        console.log("Alice's Token Balance after Unstaking for second ID:-",
            fromWei(balanceAfter3.toString(),'ether'));
        let balanceAfter4 = await rToken.balanceOf(alice.address);
        console.log("Alice's Reward Token Balance after Unstaking for second ID:-",
            fromWei(balanceAfter4.toString(),'ether'));
        let balanceBeforeBob = await token.balanceOf(bob.address);
        console.log("Bob's Token Balance before Unstaking:-", fromWei(balanceBeforeBob.toString(),'ether'));
        await (advanceTime(90 * 3600 * 24));
        await staking.connect(bob).unstake([1]);
        let balanceAfterBob1 = await token.balanceOf(bob.address);
        console.log("Bob's Token Balance after Unstaking 1st deposit:-",
            fromWei(balanceAfterBob1.toString(),'ether'));
        let balanceAfterBob2 = await rToken.balanceOf(bob.address);
        console.log("Bob's Reward Token Balance after Unstaking 1st deposit:-",
            fromWei(balanceAfterBob2.toString(),'ether'));
        const rewards = await staking.getReward(bob.address, 2);
        console.log("Get Rewards View Function before forced unstaking:-", fromWei(rewards.toString(),'ether'));
        let slashedBefore = await staking.slashedAmount();
        console.log("Slashed Amount before forced Unstaking: -",
            fromWei(slashedBefore.toString(),'ether'));
        await staking.connect(bob).forceUnstake([2]);
        let balanceAfterBob3 = await token.balanceOf(bob.address);
        console.log("Bob's Token Balance after Force Unstaking 2nd deposit before stipulated Time:-",
            fromWei(balanceAfterBob3.toString(),'ether'));
        let balanceAfterBob4 = await rToken.balanceOf(bob.address);
        console.log("Bob's Reward Token Balance after Force Unstaking 2nd deposit before stipulated Time:-",
            fromWei(balanceAfterBob4.toString(),'ether'));
        let slashedAfter = await staking.slashedAmount();
        console.log("Slashed Amount after forced Unstaking: -",
            fromWei(slashedAfter.toString(),'ether'));
        await staking.retrieveSlashedToken();
        let slashedRetrieved = await token.balanceOf(owner.address);
        console.log("Slashed Amount Retrieved by Owner: -",
            fromWei(slashedRetrieved.toString(),'ether'));
    });

    it('Test 4: Changing SlashedRate in between locking duration', async function(){
        await staking.connect(alice).stake([ethers.utils.parseEther('35')], [0]);
        await (advanceTime(60 * 3600 * 24));
        await staking.setSlashRate(30);
        const rewards = await staking.getReward(alice.address, 1);
        console.log("Get Rewards View Function before forced unstaking:-", fromWei(rewards.toString(),'ether'));
        let slashedBefore = await staking.slashedAmount();
        console.log("Slashed Amount before forced Unstaking: -",
            fromWei(slashedBefore.toString(),'ether'));
        await staking.connect(alice).forceUnstake([1]);
        let slashedAfter = await staking.slashedAmount();
        console.log("Slashed Amount after forced Unstaking: -",
            fromWei(slashedAfter.toString(),'ether'));
    });

    it('Test 5: Changing RewardRate in between locking duration and Retrieve Reward Tokens', async function(){
        await staking.connect(alice).stake([ethers.utils.parseEther('25'),
            ethers.utils.parseEther('35')], [0, 1]);
        await (advanceTime(60 * 3600 * 24));
        const rewards1 = await staking.getReward(alice.address, 1);
        console.log("Get Rewards Alice before changing rate: - ", fromWei(rewards1.toString(),'ether'));
        await staking.updateRewards([72, 80, 85]);
        await (advanceTime(60 * 3600 * 24));
        const rewards2 = await staking.getReward(alice.address, 1);
        console.log("Get Rewards Alice after changing rate: - ", fromWei(rewards2.toString(),'ether'));
        let balanceBefore = await token.balanceOf(alice.address);
        console.log("Alice's Token Balance before Unstaking:-", fromWei(balanceBefore.toString(),'ether'));
        let balanceBefore1 = await rToken.balanceOf(alice.address);
        console.log("Alice's Reward Token Balance before Unstaking:-", fromWei(balanceBefore1.toString(),'ether'));
        await staking.connect(alice).unstake([1]);
        let balanceAfter = await token.balanceOf(alice.address);
        console.log("Alice's Token Balance after Unstaking:-", fromWei(balanceAfter.toString(),'ether'));
        let balanceAfter1 = await rToken.balanceOf(alice.address);
        console.log("Alice's Reward Token Balance after Unstaking:-", fromWei(balanceAfter1.toString(),'ether'));
        let rewardToken = await rToken.balanceOf(staking.address);
        console.log("Reward Token in staking contract: -", fromWei(rewardToken.toString(),'ether'));
        let rewardTokenOwner = await rToken.balanceOf(owner.address);
        console.log("Reward Token of Owner before retrieving: -", fromWei(rewardTokenOwner.toString(),'ether'));
        await staking.retrieveToken();
        let rewardTokenOwnerAfter = await rToken.balanceOf(owner.address);
        console.log("Reward Token of Owner after retrieving: -", fromWei(rewardTokenOwnerAfter.toString(),'ether'));
    });

});