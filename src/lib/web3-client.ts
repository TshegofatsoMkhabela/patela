import { ethers } from "ethers";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

export const CELO_SEPOLIA_CONFIG = {
  chainId: "0xAA04EC", // 11142220 in hex
  chainName: "Celo Sepolia Testnet",
  nativeCurrency: {
    name: "CELO",
    symbol: "CELO",
    decimals: 18,
  },
  rpcUrls: ["https://forno.celo-sepolia.celo-testnet.org"],
  blockExplorerUrls: ["https://celo-sepolia.blockscout.com"],
};

export const CELO_MAINNET_CONFIG = {
  chainId: "0xA4EC", // 42220 in hex
  chainName: "Celo Mainnet",
  nativeCurrency: {
    name: "CELO",
    symbol: "CELO",
    decimals: 18,
  },
  rpcUrls: ["https://forno.celo.org"],
  blockExplorerUrls: ["https://celoscan.io"],
};

/**
 * Switches MetaMask to Celo Sepolia Testnet (or adds it if not present)
 */
export async function switchToCeloSepolia() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CELO_SEPOLIA_CONFIG.chainId }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [CELO_SEPOLIA_CONFIG],
      });
    } else {
      throw switchError;
    }
  }
}

/**
 * Returns MetaMask Web3 Browser Provider & Signer
 */
export async function getWeb3Provider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not installed. Please install MetaMask to interact with the blockchain.");
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

/**
 * Fetch latest contract metadata & ABIs from backend
 */
export async function fetchContractDeployments() {
  const res = await fetch(`${BACKEND_URL}/api/contracts`);
  if (!res.ok) {
    throw new Error("Failed to fetch contract deployments from backend.");
  }
  return await res.json();
}

/**
 * Connect to PatellaEscrowAndLogistics using MetaMask
 */
export async function getEscrowContractWithSigner() {
  const { signer } = await getWeb3Provider();
  const deployments = await fetchContractDeployments();
  const { address, abi } = deployments.contracts.PatellaEscrowAndLogistics;
  return new ethers.Contract(address, abi, signer);
}

/**
 * Connect to CZAR ERC20 stablecoin using MetaMask
 */
export async function getCZARContractWithSigner() {
  const { signer } = await getWeb3Provider();
  const deployments = await fetchContractDeployments();
  const czarAddress = deployments.czarTokenAddress;
  if (!czarAddress) {
    throw new Error("CZAR token contract address is not configured.");
  }
  return new ethers.Contract(czarAddress, ERC20_ABI, signer);
}

/**
 * Approve escrow contract to spend CZAR stablecoin from connected MetaMask wallet
 */
export async function approveCZAREscrow(amountString: string) {
  const { signer } = await getWeb3Provider();
  const czar = await getCZARContractWithSigner();
  const deployments = await fetchContractDeployments();
  const escrowAddress = deployments.contracts.PatellaEscrowAndLogistics.address;
  
  const decimals = await czar.decimals().catch(() => 18);
  const parsedAmount = ethers.parseUnits(amountString, decimals);

  const tx = await czar.approve(escrowAddress, parsedAmount);
  return await tx.wait();
}

