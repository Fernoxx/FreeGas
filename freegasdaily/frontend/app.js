// Contract configuration
const CONTRACT_ADDRESS = '0x73Ce62F638A4De74B92307DfEC4837a4E6c6e3eE';
const CONTRACT_ABI = [
    "function claim() external",
    "function lastClaim(address) view returns (uint256)",
    "function claimAmount() view returns (uint256)",
    "function paused() view returns (bool)",
    "function owner() view returns (address)",
    "event Claimed(address indexed user, uint256 amount, uint256 time)"
];

// Network configuration
const CELO_MAINNET_PARAMS = {
    chainId: '0xA4EC', // 42220 in hex
    chainName: 'Celo',
    nativeCurrency: {
        name: 'CELO',
        symbol: 'CELO',
        decimals: 18
    },
    rpcUrls: ['https://forno.celo.org'],
    blockExplorerUrls: ['https://celoscan.io']
};

// Global variables
let provider = null;
let signer = null;
let contract = null;
let userAddress = null;
let countdownInterval = null;

// Initialize app
window.addEventListener('load', async () => {
    if (typeof window.ethereum !== 'undefined') {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // Check if already connected
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
            await connectWallet();
        }
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else {
                connectWallet();
            }
        });
        
        // Listen for chain changes
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
    } else {
        showStatus('error', 'Please install MetaMask or another Web3 wallet!');
        document.getElementById('mainButton').disabled = true;
    }
    
    await updateContractBalance();
});

// Handle button click
async function handleButtonClick() {
    if (!userAddress) {
        await connectWallet();
    } else {
        await claimTokens();
    }
}

// Connect wallet
async function connectWallet() {
    try {
        showStatus('info', 'Connecting wallet...');
        
        // Request account access
        await provider.send("eth_requestAccounts", []);
        
        // Check network
        const network = await provider.getNetwork();
        if (network.chainId !== 42220) {
            // Try to switch to CELO network
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0xA4EC' }],
                });
            } catch (switchError) {
                // This error code indicates that the chain has not been added to MetaMask
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [CELO_MAINNET_PARAMS],
                        });
                    } catch (addError) {
                        showStatus('error', 'Failed to add CELO network to wallet');
                        return;
                    }
                } else {
                    showStatus('error', 'Please switch to CELO network');
                    document.getElementById('networkWarning').style.display = 'block';
                    return;
                }
            }
        }
        
        document.getElementById('networkWarning').style.display = 'none';
        
        // Get signer and contract
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        // Update UI
        document.getElementById('userAddress').textContent = 
            userAddress.substring(0, 6) + '...' + userAddress.substring(38);
        document.getElementById('mainButton').textContent = 'Claim CELO';
        
        hideStatus();
        await updateClaimStatus();
        await updateContractBalance();
        
    } catch (error) {
        console.error('Connection error:', error);
        showStatus('error', error.message || 'Failed to connect wallet');
    }
}

// Disconnect wallet
function disconnectWallet() {
    userAddress = null;
    signer = null;
    contract = null;
    
    document.getElementById('userAddress').textContent = 'Not connected';
    document.getElementById('mainButton').textContent = 'Connect Wallet';
    document.getElementById('nextClaim').textContent = 'Connect wallet';
    
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

// Update claim status
async function updateClaimStatus() {
    if (!contract || !userAddress) return;
    
    try {
        const lastClaimTime = await contract.lastClaim(userAddress);
        const lastClaimTimestamp = lastClaimTime.toNumber();
        const now = Math.floor(Date.now() / 1000);
        const oneDayInSeconds = 24 * 60 * 60;
        const nextClaimTime = lastClaimTimestamp + oneDayInSeconds;
        
        // Check if paused
        const isPaused = await contract.paused();
        if (isPaused) {
            document.getElementById('nextClaim').textContent = 'Contract paused';
            document.getElementById('mainButton').disabled = true;
            document.getElementById('mainButton').textContent = 'Contract Paused';
            return;
        }
        
        if (lastClaimTimestamp === 0) {
            // Never claimed
            document.getElementById('nextClaim').textContent = 'Available now!';
            document.getElementById('mainButton').disabled = false;
        } else if (now >= nextClaimTime) {
            // Can claim now
            document.getElementById('nextClaim').textContent = 'Available now!';
            document.getElementById('mainButton').disabled = false;
        } else {
            // Show countdown
            document.getElementById('mainButton').disabled = true;
            startCountdown(nextClaimTime);
        }
        
    } catch (error) {
        console.error('Error checking claim status:', error);
        showStatus('error', 'Failed to check claim status');
    }
}

// Start countdown timer
function startCountdown(nextClaimTime) {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    function updateTimer() {
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = nextClaimTime - now;
        
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            document.getElementById('nextClaim').textContent = 'Available now!';
            document.getElementById('mainButton').disabled = false;
            return;
        }
        
        const hours = Math.floor(timeLeft / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);
        const seconds = timeLeft % 60;
        
        document.getElementById('nextClaim').innerHTML = 
            `<span class="countdown">${hours}h ${minutes}m ${seconds}s</span>`;
    }
    
    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}

// Claim tokens
async function claimTokens() {
    if (!contract || !userAddress) return;
    
    try {
        showStatus('info', 'Preparing transaction...' + '<span class="loader"></span>');
        document.getElementById('mainButton').disabled = true;
        
        // Estimate gas
        const gasEstimate = await contract.estimateGas.claim();
        const gasPrice = await provider.getGasPrice();
        
        // Send transaction
        const tx = await contract.claim({
            gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
            gasPrice: gasPrice
        });
        
        showStatus('info', 'Transaction sent! Waiting for confirmation...' + '<span class="loader"></span>');
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            showStatus('success', '✅ Successfully claimed 0.2 CELO!');
            
            // Update UI
            await updateClaimStatus();
            await updateContractBalance();
            
            // Show transaction link
            setTimeout(() => {
                showStatus('success', 
                    `✅ Successfully claimed 0.2 CELO! 
                    <a href="https://celoscan.io/tx/${tx.hash}" target="_blank" style="color: #155724; text-decoration: underline;">
                        View transaction
                    </a>`
                );
            }, 1000);
        } else {
            showStatus('error', 'Transaction failed!');
        }
        
    } catch (error) {
        console.error('Claim error:', error);
        
        let errorMessage = 'Failed to claim tokens';
        if (error.reason) {
            errorMessage = error.reason;
        } else if (error.message) {
            if (error.message.includes('already claimed today')) {
                errorMessage = 'You have already claimed today!';
            } else if (error.message.includes('insufficient contract balance')) {
                errorMessage = 'Contract has insufficient balance';
            } else if (error.message.includes('paused')) {
                errorMessage = 'Contract is paused';
            } else if (error.message.includes('user rejected')) {
                errorMessage = 'Transaction cancelled';
            }
        }
        
        showStatus('error', errorMessage);
        document.getElementById('mainButton').disabled = false;
    }
}

// Update contract balance
async function updateContractBalance() {
    try {
        const tempProvider = provider || new ethers.providers.JsonRpcProvider('https://forno.celo.org');
        const balance = await tempProvider.getBalance(CONTRACT_ADDRESS);
        const formattedBalance = ethers.utils.formatEther(balance);
        document.getElementById('contractBalance').textContent = 
            parseFloat(formattedBalance).toFixed(2) + ' CELO';
    } catch (error) {
        console.error('Error fetching contract balance:', error);
        document.getElementById('contractBalance').textContent = 'Error';
    }
}

// Show status message
function showStatus(type, message) {
    const statusEl = document.getElementById('status');
    statusEl.className = 'status ' + type;
    statusEl.innerHTML = message;
    statusEl.style.display = 'block';
}

// Hide status message
function hideStatus() {
    document.getElementById('status').style.display = 'none';
}

// Auto-refresh contract balance every 30 seconds
setInterval(updateContractBalance, 30000);