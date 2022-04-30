// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable {
    constructor() ERC20("Token", "TOK") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function mintTestTokens(uint _amt) public{
        _mint(msg.sender, _amt * (10 ** uint256(decimals())));
    }
}
