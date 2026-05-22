const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment to Base Mainnet...");
  
  // Get the ContractFactory
  const StarcadeGame = await hre.ethers.getContractFactory("StarcadeGame");
  
  // Deploy
  const starcadeGame = await StarcadeGame.deploy();
  
  // Wait for it to be mined
  await starcadeGame.waitForDeployment();
  
  const address = await starcadeGame.getAddress();
  console.log(`\n✅ STARCADE GAME DEPLOYED SUCCESSFULLY!`);
  console.log(`=========================================`);
  console.log(`Contract Address: ${address}`);
  console.log(`=========================================\n`);
  
  // Automatically update the .env file with the new address
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent.replace(
    /VITE_CONTRACT_MAINNET=0x[a-fA-F0-9]{40}/,
    `VITE_CONTRACT_MAINNET=${address}`
  );
  fs.writeFileSync(envPath, envContent);
  console.log(`📄 Updated .env with VITE_CONTRACT_MAINNET=${address}`);

  // Also sync address into the ABI JSON used by the frontend
  const jsonPath = path.join(__dirname, '..', 'src', 'contracts', 'StarcadeGame.json');
  const contractJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  contractJson.address = address;
  fs.writeFileSync(jsonPath, JSON.stringify(contractJson, null, 2) + '\n');
  console.log(`📄 Updated src/contracts/StarcadeGame.json address to ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
