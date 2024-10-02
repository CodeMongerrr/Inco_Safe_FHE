import { expect } from "chai";
import { createInstances } from "../instance";
import { getSigners } from "../signers";
import { ethers } from "hardhat"; // Use only ethers from hardhat
import { deployEncryptedERC20Fixture, deployERC20, deploySafe } from "./UpdatedSafe.fixture";
import { AbiCoder } from "ethers";
import {
  buildContractCall,
  buildSafeTransaction,
  buildSignatureBytes,
  calculateSafeTransactionHash,
  executeContractCallWithSigners,
  executeTx,
  safeApproveHash,
} from "../execution";
import "./../execution"

describe("Safe", function () {
  before(async function () {
    this.signers = await getSigners(ethers); // Use hardhat ethers here
  });

  it("initialize space", async function () {

    console.log(" \n 1} Deploying the contracts \n");
    const erc20Contracts = await deployERC20()
    const ERC20_Address = await erc20Contracts.getAddress()
    const contract = await deployEncryptedERC20Fixture(ERC20_Address);
    this.contractAddress = await contract.getAddress();
    this.erc20 = contract;
    this.instances = await createInstances(this.signers);
    console.log("ERC20 Contract Address :", ERC20_Address);
    console.log("EncryptedERC20 Address : ", await contract.getAddress());



    const transaction = await this.erc20.mint(1000);
    await transaction.wait();

    // Reencrypt Alice's balance
    const balanceHandleAlice = await this.erc20.balanceOf(this.signers.alice);
    console.log("Alice Balance :", balanceHandleAlice);
    const { publicKey: publicKeyAlice, privateKey: privateKeyAlice } = this.instances.alice.generateKeypair();

    console.log("Alice Public Key   :", publicKeyAlice);
    console.log("Alice Private Key  :", privateKeyAlice);

    const eip712 = this.instances.alice.createEIP712(publicKeyAlice, this.contractAddress);
    const signatureAlice = await this.signers.alice.signTypedData(
      eip712.domain,
      { Reencrypt: eip712.types.Reencrypt },
      eip712.message,
    );

    console.log("RencryptSignatureAlice", signatureAlice);
    const balanceAlice = await this.instances.alice.reencrypt(
      balanceHandleAlice,
      privateKeyAlice,
      publicKeyAlice,
      signatureAlice.replace("0x", ""),
      this.contractAddress,
      this.signers.alice.address,
    );

    console.log("Account Balance of Alice :", balanceAlice);
    expect(balanceAlice).to.equal(1000);
    const totalSupply = await this.erc20.totalSupply();
    console.log("Total Supply of the Contract :", totalSupply);
    expect(totalSupply).to.equal(1000);

    console.log(" \n 2} Deploy and Setup the Safe Structure \n");
    console.log("Deploying Contracts \n");

    const contractOwnerSafe = await deploySafe([await this.signers.alice.getAddress(), await this.signers.eve.getAddress()], 1);
    const contractBobSafe = await deploySafe([await this.signers.bob.getAddress(), await this.signers.eve.getAddress()], 1);
    const contractCarolSafe = await deploySafe([await this.signers.carol.getAddress(), await this.signers.eve.getAddress()], 1);
    const contractDaveSafe = await deploySafe([await this.signers.dave.getAddress(), await this.signers.eve.getAddress()], 1);

    const addressOwnerSafe = await contractOwnerSafe.getAddress();
    const addressBobSafe = await contractBobSafe.getAddress();
    const addressCarolSafe = await contractCarolSafe.getAddress();
    const addressDaveSafe = await contractDaveSafe.getAddress();
    const addressERC20 = await erc20Contracts.getAddress();
    const addressEncryptedERC20 = await contract.getAddress();

    console.log("Owner Safe address: " + addressOwnerSafe);
    console.log("Bob Safe address: " + addressBobSafe);
    console.log("Carol Safe address: " + addressCarolSafe);
    console.log("Dave Safe address: " + addressDaveSafe);
    console.log("ERC20 address: " + addressERC20);
    console.log("EncryptedERC20 address: " + addressEncryptedERC20);

    let fhevmInstance = await createInstances(this.signers);
    const tokenalice = fhevmInstance.alice.getPublicKey(addressEncryptedERC20) || {
      signature: "",
      publicKey: "",
    };
    const tokenbob = fhevmInstance.bob.getPublicKey(addressEncryptedERC20) || {
      signature: "",
      publicKey: "",
    };
    const tokencarol = fhevmInstance.carol.getPublicKey(addressEncryptedERC20) || {
      signature: "",
      publicKey: "",
    };
    const tokendave = fhevmInstance.dave.getPublicKey(addressEncryptedERC20) || {
      signature: "",
      publicKey: "",
    };



    {
      console.log("\n 3}  Providing Tokens to Safe Contract \n");

      try {
        const txn = await erc20Contracts.mint(addressOwnerSafe, 1000);
        const t1 = await txn.wait();
        expect(t1?.status).to.eq(1);

        const input = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
        console.log("Transasction Hash :", txn.hash);
        await txn.wait(1);
        console.log("Minting 1,000 tokens to Owner Safe Successfully");
      } catch (error) {
        console.log("Minting 1,000 tokens to Owner Safe Failed");
      }
      try {

      } catch (error) {

      }

    }
  })
});