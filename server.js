require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const crypto = require('crypto');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("ERROR: PRIVATE_KEY is missing in .env file");
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Encryption Helper
function encrypt(text, password) {
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Format: salt:iv:encrypted
    const combined = salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
    return '0x' + Buffer.from(combined).toString('hex');
}

// Decryption Helper
function decrypt(hexData, password) {
    try {
        // Remove 0x prefix and convert from hex to string to get "salt:iv:encrypted"
        const rawData = Buffer.from(hexData.slice(2), 'hex').toString('utf8');
        const parts = rawData.split(':');
        if (parts.length !== 3) throw new Error('Invalid data format');

        const salt = Buffer.from(parts[0], 'hex');
        const iv = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];

        const key = crypto.scryptSync(password, salt, 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error("Decryption error:", error);
        throw new Error('Failed to decrypt. Wrong password or invalid data.');
    }
}

// API: Write Message
app.post('/api/write', async (req, res) => {
    try {
        const { message, password } = req.body;
        if (!message || !password) {
            return res.status(400).json({ error: 'Message and password are required' });
        }

        const encryptedHex = encrypt(message, password);

        // Send transaction to self with data
        const tx = await wallet.sendTransaction({
            to: wallet.address,
            value: 0,
            data: encryptedHex
        });

        res.json({ success: true, txHash: tx.hash });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// API: Read Message
app.post('/api/read', async (req, res) => {
    try {
        const { txHash, password } = req.body;
        if (!txHash || !password) {
            return res.status(400).json({ error: 'Transaction Hash and password are required' });
        }

        const tx = await provider.getTransaction(txHash);
        if (!tx) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const decryptedMessage = decrypt(tx.data, password);
        res.json({ success: true, message: decryptedMessage });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
