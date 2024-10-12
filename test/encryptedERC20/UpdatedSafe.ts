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

    // let fhevmInstance = await createInstances(this.signers);
    // const tokenalice = fhevmInstance.alice.getPublicKey(addressEncryptedERC20) || {
    //   signature: "",
    //   publicKey: "",
    // };
    // const tokenbob = fhevmInstance.bob.getPublicKey(addressEncryptedERC20) || {
    //   signature: "",
    //   publicKey: "",
    // };
    // const tokencarol = fhevmInstance.carol.getPublicKey(addressEncryptedERC20) || {
    //   signature: "",
    //   publicKey: "",
    // };
    // const tokendave = fhevmInstance.dave.getPublicKey(addressEncryptedERC20) || {
    //   signature: "",
    //   publicKey: "",
    // };



    {
      console.log("\n 3}  Providing Tokens to Safe Contract \n");

      try {
        const txn = await erc20Contracts.mint(addressOwnerSafe, 1000000);
        const t1 = await txn.wait();
        expect(t1?.status).to.eq(1);
        console.log("Transasction Hash :", txn.hash);
        await txn.wait(1);
        console.log("Minting 1,000 tokens to Owner Safe Successfully");

      } catch (error) {
        console.log("Minting 1,000 tokens to Owner Safe Failed");
      }

      try {
        let fnSelector = "0x095ea7b3";

        let txnHash = await contractOwnerSafe.getTransactionHash(
          addressERC20,
          0,
          fnSelector + AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [addressEncryptedERC20, 1000000]).slice(2),
          0,
          1000,
          0,
          1000000,
          addressOwnerSafe,
          this.signers.alice.getAddress(),
          await contractOwnerSafe.nonce()
        )


        console.log("The Transanction Hash generated for the Approve function", txnHash);

        const txn1 = {
          to: addressERC20,
          value: 0,
          data:
            fnSelector +
            AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [addressEncryptedERC20, 1000000]).slice(2),
          operation: 0,
          safeTxGas: 1000000,
          baseGas: 0,
          gasPrice: 1000000,
          gasToken: addressOwnerSafe,
          refundReceiver: await this.signers.alice.getAddress(),
          nonce: await contractOwnerSafe.nonce(),
        };
        const tx = buildSafeTransaction(txn1);
        const signatureBytes = buildSignatureBytes([
          await safeApproveHash(this.signers.alice, contractOwnerSafe, tx, true),
        ]);

        const txn = await contractOwnerSafe.execTransaction(
          addressERC20,
          0,
          fnSelector +
          AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [addressEncryptedERC20, 1000000]).slice(2),
          0,
          1000000,
          0,
          1000000,
          addressOwnerSafe,
          this.signers.alice.getAddress(),
          signatureBytes,
          { gasLimit: 10000000 },
        );

        console.log("Transaction hash:", txn.hash);
        await txn.wait(1);
        console.log("Approval to EncryptedERC20 successful!");
      } catch (error) {
        console.error("Approval to EncryptedERC20 failed:", error);
      }

      console.log(
        "Allowed no. of tokens: " + (await erc20Contracts.getallowance(addressOwnerSafe, addressEncryptedERC20)),
      );
    }

    console.log("\n 4} Deposit and distribute\n");
    console.log("Distributing 10_000, 30_000, 960_000 tokens to Bob, Carol, Dave safes respectively\n");
    let fnSelector = "0xf98aa085";

    const amount = 1000000;
    // const data1 = [addressBobSafe, fhevmInstance.alice.encrypt32(10000)];
    // const data2 = [addressCarolSafe, fhevmInstance.alice.encrypt32(30000)];
    // const data3 = [addressDaveSafe, fhevmInstance.alice.encrypt32(960000)];

    const num1 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
    num1.add64(10000);

    const num2 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
    num2.add64(30000);

    const num3 = this.instances.alice.createEncryptedInput(this.contractAddress, this.signers.alice.address);
    num3.add64(960000);
    const encryptedAmount1 = num1.encrypt();
    const encryptedAmount2 = num2.encrypt();
    const encryptedAmount3 = num3.encrypt();

    const data1 = [addressBobSafe, encryptedAmount1];
    const data2 = [addressCarolSafe, encryptedAmount2];
    const data3 = [addressDaveSafe, encryptedAmount3];
    const depositData = [data1, data2, data3];


    console.log("Deposit Data 1 :", data1);

    // // Encode the data
    console.log("First");
    const abiCoder = AbiCoder.defaultAbiCoder();
    console.log("Second");
    const encodedData1 = abiCoder.encode(["tuple(address,bytes)[]"], [depositData]);
    console.log("Third");
    const encodedData2 = abiCoder.encode(["uint256", "bytes"], [amount, encodedData1]);


    // let txnhash2 = await contractOwnerSafe.getTransactionHash(
    //   addressEncryptedERC20,
    //   0,
    //   fnSelector + encodedData2.slice(2),
    //   // "0xc6dad082",
    //   0,
    //   1000000,
    //   0,
    //   // 1000000,
    //   0,
    //   this.signers.alice.getAddress(),
    //   addressOwnerSafe,
    //   await contractOwnerSafe.nonce(),
    // );


    // const txn2 = {
    //   to: addressEncryptedERC20,
    //   value: 0,
    //   data: fnSelector + encodedData2.slice(2),
    //   operation: 0,
    //   safeTxGas: 1000000,
    //   baseGas: 0,
    //   gasPrice: 0,
    //   gasToken: await this.signers.alice.getAddress(),
    //   refundReceiver: addressOwnerSafe,
    //   nonce: await contractOwnerSafe.nonce(),
    // };

    const tx2 = buildSafeTransaction(txn2);
    const signatureBytes2 = buildSignatureBytes([
      await safeApproveHash(this.signers.alice, contractOwnerSafe, tx2, true),
    ]);
    // try {
    //   // const txn = await contractOwnerSafe.setup([this.signers.alice.getAddress()], 0, this.signers.alice.getAddress(), "0x", this.signers.alice.getAddress(), this.signers.alice.getAddress(), 0, this.signers.alice.getAddress());
    //   // const txn = await contractOwnerSafe.addOwnerWithThreshold(this.signers.alice.getAddress(), 1);
    //   const txn = await contractOwnerSafe.execTransaction(
    //     addressEncryptedERC20,
    //     0,
    //     fnSelector + encodedData2.slice(2),
    //     // "0xc6dad082",
    //     0,
    //     1000000,
    //     0,
    //     // 1000000,
    //     0,
    //     this.signers.alice.getAddress(),
    //     addressOwnerSafe,
    //     signatureBytes2,
    //     { gasLimit: 10000000 },
    //   );
    //   console.log("Transaction hash:", txn.hash);
    //   await txn.wait(1);
    //   console.log("Wrap and distribute to receiver safes successful!");
    // } catch (error) {
    //   console.error("Wrap and distribute to receiver safes failed:", error);
    // }

    // console.log(
    //   "ERC20 tokens held by Encrypted20 contract: " + (await erc20Contracts.balanceOf(addressEncryptedERC20)) + "\n",
    // );
  })
});