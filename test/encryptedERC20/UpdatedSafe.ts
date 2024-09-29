import { expect } from "chai";
import { createInstances } from "../instance";
import { getSigners } from "../signers";
import { ethers } from "hardhat";
import { deployERC20, deployEncryptedERC20, deploySafe } from "./UpdatedSafe.fixture";


describe("Safe", function () {
    before(async function () {
        this.signers = await getSigners(ethers);
    });
    it("initialize space", async function () {
        console.log(this.signers.alice.getAddress());
        console.log(this.signers.bob.getAddress());
        console.log(this.signers.carol.getAddress());
        console.log(this.signers.dave.getAddress());

        console.log("\n 1) Deploying contracts... \n");
        const contractOwnerSafe = await deploySafe([await this.signers.alice.getAddress(), await this.signers.eve.getAddress()], 1);
        const contractBobSafe = await deploySafe([await this.signers.bob.getAddress(), await this.signers.eve.getAddress()], 1);
        const contractCarolSafe = await deploySafe([await this.signers.carol.getAddress(), await this.signers.eve.getAddress()], 1);
        const contractDaveSafe = await deploySafe([await this.signers.dave.getAddress(), await this.signers.eve.getAddress()], 1);
        const contractERC20 = await deployERC20();
        const contractEncryptedERC20 = await deployEncryptedERC20(await contractERC20.getAddress());

        const addressOwnerSafe = await contractOwnerSafe.getAddress();
        const addressBobSafe = await contractBobSafe.getAddress();
        const addressCarolSafe = await contractCarolSafe.getAddress();
        const addressDaveSafe = await contractDaveSafe.getAddress();
        const addressERC20 = await contractERC20.getAddress();
        const addressEncryptedERC20 = await contractEncryptedERC20.getAddress();

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
            console.log("\n 2) Providing tokens to safe contract\n");

            try {
                const txn = await contractERC20.mint(addressOwnerSafe, 1000000);
                console.log("Transaction hash:", txn.hash);
                await txn.wait(1);
                console.log("Minting 1_000_000 tokens to Owner Safe successful!");
            } catch (error) {
                console.error("Minting 1_000_000 tokens to Owner Safe failed:", error);
            }

            try {
                let fnSelector = "0x095ea7b3";

                let txnhash = await contractOwnerSafe.getTransactionHash(
                    addressERC20,
                    0,
                    fnSelector + 
                )
            } catch (error) {

            }
        }
    })

})