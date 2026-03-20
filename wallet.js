const bip39 = require('bip39');
const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
const { ethers } = require('ethers');

const bip32 = BIP32Factory(ecc);

// Proper Litecoin network configuration
const litecoinNetwork = {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'ltc',
    bip32: {
        public: 0x019da462,
        private: 0x019d9cfe
    },
    pubKeyHash: 0x30,  // L
    scriptHash: 0x32,  // M
    wif: 0xb0
};

function generateLTCAddress(mnemonic, index) {
    try {
        if (!mnemonic || typeof mnemonic !== 'string') {
            throw new Error('Invalid mnemonic');
        }
        
        if (!bip39.validateMnemonic(mnemonic.trim())) {
            throw new Error('Invalid mnemonic phrase');
        }
        
        const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
        const root = bip32.fromSeed(seed, litecoinNetwork);
        const child = root.derivePath(`m/44'/2'/0'/0/${index}`);
        
        // Generate P2WPKH address (ltc1...)
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: litecoinNetwork
        });
        
        return { address, index, privateKey: child.toWIF(litecoinNetwork) };
    } catch (err) {
        console.error('LTC error:', err);
        throw err;
    }
}

function generateETHAddress(mnemonic, index) {
    try {
        const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        const child = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
        return { address: child.address, index, privateKey: child.privateKey };
    } catch (err) {
        console.error('ETH error:', err);
        throw err;
    }
}

module.exports = { generateLTCAddress, generateETHAddress };
