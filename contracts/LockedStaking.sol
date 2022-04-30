//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract LockedStaking is Ownable,ReentrancyGuard{

    IERC20 Token;
    IERC20 RewardToken;

    struct info{
        uint amount;
        uint lastClaim;
        uint stakeTime;
        uint durationCode;
        uint position;
        uint rateIndex;
    }

    uint[3] public durations = [90 days, 180 days, 360 days];
    uint[][] public rate;
    uint[] public time;

    uint slashRate = 50;
    uint public slashedAmount;

    mapping(address=>mapping(uint=>info)) public userStaked; //USER > ID > INFO
    mapping(address=>uint) public userId;
    mapping(address=>uint[]) public stakedIds;

    bool public pause;

    constructor(address _token,address _reward) {
        Token = IERC20(_token);
        RewardToken = IERC20(_reward);
        uint8[3] memory firstRate = [20,30,40];
        rate.push(firstRate);
        time.push(block.timestamp);
    }

    function stake(uint[] memory _amount,uint[] memory _duration) external {
        require(!pause,"Execution paused");
        require(_amount.length == _duration.length,"length mismatch");
        uint length = _amount.length;
        uint amount = 0;
        for(uint i = 0;i< length;i++){
            require(_duration[i] < 3,"Invalid duration");
            userId[msg.sender]++;
            amount += _amount[i];
            userStaked[msg.sender][userId[msg.sender]] = info(_amount[i],block.timestamp,block.timestamp,_duration[i],stakedIds[msg.sender].length,time.length-1);
            stakedIds[msg.sender].push(userId[msg.sender]);
        }
        require(Token.transferFrom(msg.sender,address(this),amount),"Amount not sent");
    }

    function getReward(address _user,uint _id) public view returns(uint) {
        info storage userInfo = userStaked[_user][_id];
        uint currentTime;
        uint collected = 0;
        for(uint i=userInfo.rateIndex;i<rate.length;i++){
            if(userInfo.lastClaim < time[i]){
                if(collected == 0){
                collected += (time[i] - userInfo.lastClaim) * rate[i-1][userInfo.durationCode];
                }
                else{
                collected += (time[i] - time[i-1])*rate[i-1][userInfo.durationCode];
                }
            }
            currentTime = i;
        }
        collected += (block.timestamp - time[currentTime])*rate[currentTime][userInfo.durationCode];
        return collected*userInfo.amount/(360 days * 100);
    }

    function claimReward(uint[] memory _ids) public {
        uint length = _ids.length;
        uint amount = 0;
        for(uint i=0;i<length;i++){
            require(userStaked[msg.sender][_ids[i]].amount != 0,"Invalid ID");
            info storage userInfo = userStaked[msg.sender][_ids[i]];
            amount += getReward(msg.sender, _ids[i]);
            userInfo.lastClaim = block.timestamp;
            userInfo.rateIndex = time.length - 1;
        }
        RewardToken.transfer(msg.sender,amount);
    }

    function unstake(uint[] memory _ids) external nonReentrant{
        claimReward(_ids);
        uint length = _ids.length;
        uint amount = 0;
        for(uint i=0;i<length;i++){
            info storage userInfo = userStaked[msg.sender][_ids[i]];
            require(userInfo.amount != 0,"Invalid ID");
            require(block.timestamp - userInfo.stakeTime >= durations[userInfo.durationCode],"Not unlocked yet");
            amount += userInfo.amount;
            popSlot(_ids[i]);
            delete userStaked[msg.sender][_ids[i]];
        }
        Token.transfer(msg.sender,amount);
    }

    function forceUnstake(uint[] memory _ids) external nonReentrant{
        claimReward(_ids);
        uint length = _ids.length;
        uint amount = 0;
        for(uint i=0;i<length;i++){
            info storage userInfo = userStaked[msg.sender][_ids[i]];
            require(userInfo.amount != 0,"Invalid ID");
            require(block.timestamp - userInfo.stakeTime < durations[userInfo.durationCode],"Already unlocked");
            amount += userInfo.amount*(100-slashRate)/100;
            slashedAmount += userInfo.amount - userInfo.amount*(100-slashRate)/100;
            popSlot(_ids[i]);
            delete userStaked[msg.sender][_ids[i]];
        }
        Token.transfer(msg.sender,amount);
    }

    function popSlot(uint _id) private {
        uint lastID = stakedIds[msg.sender][stakedIds[msg.sender].length - 1];
        uint currentPos = userStaked[msg.sender][_id].position;
        stakedIds[msg.sender][currentPos] = lastID;
        userStaked[msg.sender][lastID].position = currentPos;
        stakedIds[msg.sender].pop();
    }

    function setToken(address _token) external onlyOwner{
        Token = IERC20(_token);
    }

    function retrieveToken() external onlyOwner{
        RewardToken.transfer(msg.sender,RewardToken.balanceOf(address(this)));
    }

    function retrieveSlashedToken() external onlyOwner{
        uint amount = slashedAmount;
        slashedAmount = 0;
        Token.transfer(msg.sender,amount);
    }

    function setSlashRate(uint _rate) external onlyOwner{
        slashRate = _rate;
    }

    function updateRewards(uint[3] memory _newRate) external onlyOwner{
        rate.push(_newRate);
        time.push(block.timestamp);
    }

    function Pause(bool _pause) external onlyOwner {
        pause = _pause;
    }

}