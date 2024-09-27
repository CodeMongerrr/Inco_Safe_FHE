// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "fhevm/gateway/GatewayCaller.sol";
import {ERC20} from "./ERC20.sol"; 

contract EncryptedERC20 is Ownable2Step {
    event Transfer(address indexed from, address indexed to);
    event Approval(address indexed owner, address indexed spender);
    event Mint(address indexed to, uint64 amount);

    ERC20 public originalToken;
    //The owner of the Contract 
    address internal contractOwner;
    uint64 private _totalSupply;
    mapping(address => euint64) internal balances;
    mapping(address => mapping(address => euint64)) internal allowances;


    constructor(address _erc20) Ownable(msg.sender){
        originalToken = ERC20(_erc20);
    }

    function make() public pure {

    }

    function totalSupply() public view virtual returns (uint64) {
        return _totalSupply;
    }

    function mint(uint64 mintedAmount) public virtual onlyOwner {
        balances[owner()] = TFHE.add(balances[owner()], mintedAmount); // overflow impossible because of next line
        TFHE.allow(balances[owner()], address(this));
        TFHE.allow(balances[owner()], owner());
        _totalSupply = _totalSupply + mintedAmount;
        emit Mint(owner(), mintedAmount);
    }

    function mintTo(address to, uint64 mintedAmount) public virtual onlyOwner {
        balances[to] = TFHE.add(balances[to], mintedAmount);
        TFHE.allow(balances[to], address(this));
        TFHE.allow(balances[to], address(to));
        _totalSupply = _totalSupply + mintedAmount;
        emit Mint(address(to), mintedAmount);
    }

    function _transfer(address from, address to, euint64 amount, ebool isTransferable) internal virtual {
        // Add to the balance of `to` and subract from the balance of `from`.
        euint64 transferValue = TFHE.select(isTransferable, amount, TFHE.asEuint64(0));
        euint64 newBalanceTo = TFHE.add(balances[to], transferValue);
        balances[to] = newBalanceTo;
        TFHE.allow(newBalanceTo, address(this));
        TFHE.allow(newBalanceTo, to);
        euint64 newBalanceFrom = TFHE.sub(balances[from], transferValue);
        balances[from] = newBalanceFrom;
        TFHE.allow(newBalanceFrom, address(this));
        TFHE.allow(newBalanceFrom, from);
        emit Transfer(from, to);
    }

    function transfer(address to, einput encryptedAmount, bytes calldata inputProof) public virtual returns (bool) {
        transfer(to, TFHE.asEuint64(encryptedAmount, inputProof));
        return true;
    }

    function transfer(address to, euint64 amount) public virtual returns (bool) {
        require(TFHE.isSenderAllowed(amount));
        ebool canTransfer = TFHE.le(amount, balances[msg.sender]);
        _transfer(msg.sender, to, amount, canTransfer);
        return true;
    }
    
    function balanceOf(address wallet) public view virtual returns (euint64) {
        return balances[wallet];
    }

    function approve(address spender, euint64 amount) public virtual returns (bool) {
        require(TFHE.isSenderAllowed(amount));
        address owner = msg.sender;
        _approve(owner, spender, amount);
        emit Approval(owner, spender);
        return true;
    }

    function _approve(address owner, address spender, euint64 amount) internal virtual {
        allowances[owner][spender] = amount;
        TFHE.allow(amount, address(this));
        TFHE.allow(amount, owner);
        TFHE.allow(amount, spender);
    }

    function allowance(address owner, address spender) public view virtual returns (euint64) {
        return _allowance(owner, spender);
    }

    function _allowance(address owner, address spender) internal view virtual returns (euint64) {
        return allowances[owner][spender];
    }

    function transferFrom(
        address from,
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) public virtual returns (bool) {
        transferFrom(from, to, TFHE.asEuint64(encryptedAmount, inputProof));
        return true;
    }

    function transferFrom(address from, address to, euint64 amount) public virtual returns (bool) {
        require(TFHE.isSenderAllowed(amount));
        address spender = msg.sender;
        ebool isTransferable = _updateAllowance(from, spender, amount);
        _transfer(from, to, amount, isTransferable);
        return true;
    }

    function _updateAllowance(address owner, address spender, euint64 amount) internal virtual returns (ebool) {
        euint64 currentAllowance = _allowance(owner, spender);
        // makes sure the allowance suffices
        ebool allowedTransfer = TFHE.le(amount, currentAllowance);
        // makes sure the owner has enough tokens
        ebool canTransfer = TFHE.le(amount, balances[owner]);
        ebool isTransferable = TFHE.and(canTransfer, allowedTransfer);
        _approve(owner, spender, TFHE.select(isTransferable, TFHE.sub(currentAllowance, amount), currentAllowance));
        return isTransferable;
    }

    function claim() public {
    euint64 encryptedBalance = balances[msg.sender];
    
    // Decrypt the balance
    uint64 amount = TFHE.decrypt(encryptedBalance);
    
    // Ensure the contract has enough balance in the original token
    require(originalToken.balanceOf(address(this)) >= amount, "Insufficient contract balance");
    
    // Transfer the amount from the original token to the sender
    require(originalToken.transfer(msg.sender, amount), "Transfer failed");
    
    // Reset the encrypted balance to zero
    balances[msg.sender] = TFHE.asEuint64(0);
    
    // Allow the contract to modify the balance
    TFHE.allow(balances[msg.sender], address(this));
    
    emit Transfer(address(this), msg.sender);
}
}