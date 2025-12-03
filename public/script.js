document.addEventListener('DOMContentLoaded', () => {
    const writeForm = document.getElementById('writeForm');
    const readForm = document.getElementById('readForm');
    const resultDiv = document.getElementById('result');
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    const walletAddressDiv = document.getElementById('walletAddress');

    let userAddress = null;
    let provider = null;
    let signer = null;
    let chainId = null;
    // 0x6000805260016000f3: PUSH1 0, DUP1, MSTORE, PUSH1 1, PUSH1 0, RETURN. 
    // Result: Runtime code is "00" (STOP). Accepts all calls.
    const MINIMAL_CONTRACT_BYTECODE = "0x6000805260016000f3";

    // Helper: Show Result
    function showResult(message, isError = false) {
        if (!resultDiv) return;
        resultDiv.style.display = 'block';
        resultDiv.textContent = message;
        resultDiv.className = `result ${isError ? 'error' : 'success'}`;
    }

    // MetaMask Connection
    async function connectWallet() {
        if (typeof window.ethereum !== 'undefined') {
            try {
                provider = new ethers.BrowserProvider(window.ethereum);
                const accounts = await provider.send("eth_requestAccounts", []);
                handleAccountsChanged(accounts);
            } catch (error) {
                console.error(error);
                alert("Failed to connect wallet: " + error.message);
            }
        } else {
            alert("MetaMask is not installed. Please install it to use this app.");
        }
    }

    function disconnectWallet() {
        userAddress = null;
        signer = null;
        handleAccountsChanged([]);
    }

    function handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            userAddress = null;
            signer = null;
            if (connectWalletBtn) {
                connectWalletBtn.textContent = 'Connect Wallet';
                connectWalletBtn.classList.remove('connected');
            }
            if (walletAddressDiv) walletAddressDiv.style.display = 'none';
        } else {
            userAddress = accounts[0];
            if (connectWalletBtn) {
                connectWalletBtn.textContent = 'Connected';
                connectWalletBtn.classList.add('connected');
            }
            if (walletAddressDiv) {
                walletAddressDiv.textContent = `Connected: ${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
                walletAddressDiv.style.display = 'block';
            }
            // Update provider/signer
            provider = new ethers.BrowserProvider(window.ethereum);
            provider.getSigner().then(s => signer = s);
            provider.getNetwork().then(network => {
                chainId = network.chainId.toString();
                checkContractDeployment();
            });
        }
    }

    function checkContractDeployment() {
        if (!chainId || !userAddress) return;

        const savedAddress = localStorage.getItem(`storage_contract_${chainId}`);
        const deployContainer = document.getElementById('deployContainer');
        const writeForm = document.getElementById('writeForm');

        if (deployContainer && writeForm) {
            if (savedAddress) {
                deployContainer.style.display = 'none';
                writeForm.style.display = 'block';
                showResult(`Using Storage Contract: ${savedAddress.substring(0, 6)}...${savedAddress.substring(38)}`);
            } else {
                deployContainer.style.display = 'block';
                writeForm.style.display = 'none';
                showResult('Setup Required: Please deploy a storage contract first.', true);
            }
        }
    }

    const deployBtn = document.getElementById('deployBtn');
    if (deployBtn) {
        deployBtn.addEventListener('click', async () => {
            if (!signer) return;
            try {
                deployBtn.disabled = true;
                deployBtn.textContent = 'Deploying...';

                const factory = new ethers.ContractFactory([], MINIMAL_CONTRACT_BYTECODE, signer);
                const contract = await factory.deploy();

                showResult(`Deploying contract... TX: ${contract.deploymentTransaction().hash}`);
                await contract.waitForDeployment();

                const address = await contract.getAddress();
                localStorage.setItem(`storage_contract_${chainId}`, address);

                showResult(`Contract Deployed! Address: ${address}`);
                checkContractDeployment();
            } catch (err) {
                console.error(err);
                showResult(`Deployment Failed: ${err.message}`, true);
            } finally {
                deployBtn.disabled = false;
                deployBtn.textContent = 'Deploy Storage Contract';
            }
        });
    }

    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', () => {
            if (userAddress) {
                disconnectWallet();
            } else {
                connectWallet();
            }
        });

        // Hover effects for Disconnect
        connectWalletBtn.addEventListener('mouseenter', () => {
            if (userAddress) {
                connectWalletBtn.textContent = 'Disconnect';
                connectWalletBtn.style.backgroundColor = '#ef4444'; // Red color
            }
        });

        connectWalletBtn.addEventListener('mouseleave', () => {
            if (userAddress) {
                connectWalletBtn.textContent = 'Connected';
                connectWalletBtn.style.backgroundColor = ''; // Reset to default (green via class)
            }
        });
    }

    // Auto-connect if already authorized
    if (typeof window.ethereum !== 'undefined') {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        // Check if already connected
        window.ethereum.request({ method: 'eth_accounts' })
            .then(handleAccountsChanged)
            .catch(console.error);
    }

    // Write Form Handler
    if (writeForm) {
        writeForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!userAddress || !signer) {
                showResult('Please connect your wallet first!', true);
                return;
            }

            const message = document.getElementById('message').value;
            const password = document.getElementById('password').value;
            const submitBtn = writeForm.querySelector('button');

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Encrypting...';
                resultDiv.style.display = 'none';

                // 1. Get Encrypted Data from Server
                const response = await fetch('/api/encrypt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message, password })
                });

                const data = await response.json();
                if (!data.success) throw new Error(data.error);

                // 2. Send Transaction via MetaMask
                submitBtn.textContent = 'Please Sign in Wallet...';

                // Get contract address
                const contractAddress = localStorage.getItem(`storage_contract_${chainId}`);
                if (!contractAddress) {
                    throw new Error("No storage contract found. Please reload and deploy.");
                }

                const tx = await signer.sendTransaction({
                    to: contractAddress, // Send to Contract
                    value: 0,
                    data: data.data // Encrypted hex
                });

                submitBtn.textContent = 'Sending...';
                await tx.wait(); // Wait for confirmation

                showResult(`Success! TXID: ${tx.hash}`);
            } catch (err) {
                console.error(err);
                showResult(`Error: ${err.message || err.code}`, true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Write to Chain';
            }
        });
    }

    // Read Form Handler (Unchanged logic, just UI updates)
    if (readForm) {
        readForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const txHash = document.getElementById('txHash').value;
            const password = document.getElementById('password').value;
            const submitBtn = readForm.querySelector('button');

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Fetching & Decrypting...';
                resultDiv.style.display = 'none';

                const response = await fetch('/api/read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ txHash, password })
                });

                const data = await response.json();

                if (data.success) {
                    showResult(`Decrypted Message: ${data.message}`);
                } else {
                    showResult(`Error: ${data.error}`, true);
                }
            } catch (err) {
                showResult(`Network Error: ${err.message}`, true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Read Message';
            }
        });
    }
});
