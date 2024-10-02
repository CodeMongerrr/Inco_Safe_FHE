import { ethers } from "hardhat";

import type { EncryptedERC20, ERC20, Safe } from "../../types";
import { getSigners } from "../signers";
import { Address } from "hardhat-deploy/types";

export async function deployEncryptedERC20Fixture(ERC20_Address: Address): Promise<EncryptedERC20> {
    const signers = await getSigners(ethers);

    const contractFactory = await ethers.getContractFactory("EncryptedERC20");
    const contract = await contractFactory.connect(signers.alice).deploy(ERC20_Address); // City of Zama's battle
    await contract.waitForDeployment();

    return contract;
}


export async function deployERC20(): Promise<ERC20> {
    const signers = await getSigners(ethers);

    const contractFactory = await ethers.getContractFactory("ERC20");
    const contract = await contractFactory.connect(signers.alice).deploy(); // City of Zama's battle
    await contract.waitForDeployment();
    return contract;
}


export async function deploySafe(owners: string[], threshold: number): Promise<Safe> {
    const signers = await getSigners(ethers);

    const contractFactory = await ethers.getContractFactory("Safe");
    const contract = await contractFactory.connect(signers.alice).deploy(owners, threshold); // City of Zama's battle
    await contract.waitForDeployment();

    return contract;
}
