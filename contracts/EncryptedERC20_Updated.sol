// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./TestAsyncDecrypt.sol";
import "fhevm/gateway/GatewayCaller.sol";
import {ERC20} from "./ERC20.sol"; 

contract EncryptedERC20 is Ownable2Step, GatewayCaller {
    event Transfer(address indexed from, address indexed to);
    event Approval(address indexed owner, address indexed spender);
    event Mint(address indexed to, uint64 amount);
    TestAsyncDecrypt public decrypt;
    ERC20 public originalToken;
    //The owner of the Contract 
    address internal contractOwner;
    uint64 private _totalSupply;
    mapping(address => euint64) internal balances;
    mapping(address => mapping(address => euint64)) internal allowances;
    euint64 public xUint64;
    euint32 public xUint32;
    uint64 public yUint64;
    uint32 public yUint32;

    struct Depositstruct{
        address to;
        euint32 encryptedAmount;
    }
    constructor(address _erc20) Ownable(msg.sender){
        originalToken = ERC20(_erc20);
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
    function gatewaySetup() internal {
        TFHE.allow(xUint64, address(this));
    }

    function requestUint64() public {
        uint256[] memory cts = new uint256[](1);
        cts[0] = Gateway.toUint256(xUint64);
        Gateway.requestDecryption(cts, this.callbackUint64.selector, 0, block.timestamp + 100, false);
    }

    function callbackUint64(uint256 , uint64 decryptedInput) public onlyGateway returns (uint64) {
        yUint64 = decryptedInput;
        return decryptedInput;
    }

    function requestUint32() public {
        uint256[] memory cts = new uint256[](1);
        cts[0] = Gateway.toUint256(xUint32);
        Gateway.requestDecryption(
            cts,
            this.callbackUint32.selector,
            0,
            block.timestamp + 100,
            false
        );
    }

    function callbackUint32(uint256, uint32 decryptedInput) public onlyGateway returns (uint32) {
        yUint32 = decryptedInput;
        return yUint32;

    }

    function claim() public {
    xUint64 = balances[msg.sender];
    requestUint64();
    uint64 amount = yUint64;
    require(originalToken.balanceOf(address(this)) >= amount, "Insufficient contract balance");
    require(originalToken.transfer(msg.sender, amount), "Transfer failed");
    TFHE.allow(balances[msg.sender], address(this));
    
    emit Transfer(address(this), msg.sender);
    }

    function getAddress() public view returns (address) {
        return address(this);
    }

    function wrapAndDistribute(uint256 amount, bytes memory depositData) public {
        originalToken.transferFrom(msg.sender, address(this), amount);
        Depositstruct[] memory data = abi.decode(depositData, (Depositstruct[]));
        euint32 totalAmount;
        for(uint i; i < data.length; i++) {
            xUint32 = data[i].encryptedAmount;
            requestUint32();
            mintTo(data[i].to, yUint32);
            totalAmount = TFHE.add(totalAmount, data[i].encryptedAmount);
        }
    }
}