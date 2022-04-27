//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract LockedStaking is Ownable,ReentrancyGuard{

    IERC20 Token;

    struct info{
        uint amount;
        uint lastClaim;
        uint stakeTime;
        uint durationCode;
        uint position;
    }

    uint[3] public durations = [90 days,180 days, 360 days];
    uint[3] public rate = [20,30,40];
    uint public lockedAmount;

    mapping(address=>mapping(uint=>info)) public userStaked; //USER > ID > INFO
    mapping(address=>uint) public userId;
    mapping(address=>uint[]) public stakedIds;

    bool public pause;

    constructor(address _token) {
        Token = IERC20(_token);
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
            userStaked[msg.sender][userId[msg.sender]] = info(_amount[i],block.timestamp,block.timestamp,_duration[i],stakedIds[msg.sender].length);
            stakedIds[msg.sender].push(userId[msg.sender]);
        }
        lockedAmount += amount;
        require(Token.transferFrom(msg.sender,address(this),amount),"Amount not sent");
    }

    function getReward(address _user,uint _id) public view returns(uint){
        info storage userInfo = userStaked[_user][_id];
        uint amount = rate[userInfo.durationCode]*userInfo.amount*(block.timestamp - userInfo.lastClaim)/(360 days * 100);
        return amount;
    }

    function claimReward(uint[] memory _ids) public {
        uint length = _ids.length;
        uint amount = 0;
        for(uint i=0;i<length;i++){
            require(userStaked[msg.sender][_ids[i]].amount != 0,"Invalid ID");
            info storage userInfo = userStaked[msg.sender][_ids[i]];
            amount += getReward(msg.sender, _ids[i]);
            userInfo.lastClaim = block.timestamp;
        }
        Token.transfer(msg.sender,amount);
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
        lockedAmount -= amount;
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
        Token.transfer(msg.sender,Token.balanceOf(address(this))-lockedAmount);
    }

    function Pause(bool _pause) external onlyOwner {
        pause = _pause;
    }

}