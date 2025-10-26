import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "../chainconfess-hardhat/deployments");
const outDir = resolve(process.cwd(), "abi");
if (!existsSync(outDir)) mkdirSync(outDir);

const networks = ["sepolia", "localhost", "hardhat"];

const abiOut = resolve(outDir, "ChainConfessABI.json");
const addrOut = resolve(outDir, "ChainConfessAddresses.json");

let abi = null;
const addresses = {};

for (const net of networks) {
  try {
    const file = resolve(root, net, "ChainConfess.json");
    const json = JSON.parse(readFileSync(file, "utf-8"));
    if (!abi) abi = json.abi;
    // store chainId->address
    const chainIdFile = resolve(root, net, ".chainId" );
    let chainId = undefined;
    try { chainId = Number(readFileSync(chainIdFile, "utf-8").trim()); } catch {}
    if (!chainId) {
      if (net === "sepolia") chainId = 11155111;
      else if (net === "localhost" || net === "hardhat") chainId = 31337;
    }
    const addr = json.address;
    if (chainId && addr) addresses[String(chainId)] = { address: addr };
  } catch {}
}

if (!abi) throw new Error("ABI not found. Deploy first.");
writeFileSync(abiOut, JSON.stringify({ abi }, null, 2));
writeFileSync(addrOut, JSON.stringify(addresses, null, 2));
console.log("ABI and addresses generated.");


