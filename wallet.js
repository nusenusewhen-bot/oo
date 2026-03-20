const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');
const { ethers } = require('ethers');

// Handle bip32 import for different versions
let bip32;
try {
    const bip32Module = require('bip32');
    if (bip32Module.BIP32Factory) {
        const ecc = require('tiny-secp256k1');
        bip32 = bip32Module.BIP32Factory(ecc);
    } else {
        bip32 = bip32Module;
    }
} catch (err) {
    console.error('Failed to load bip32:', err.message);
    throw err;
}

function generateLTCAddress(mnemonic, index) {
    try {
        if (!mnemonic || typeof mnemonic !== 'string') {
            throw new Error('Invalid mnemonic provided');
        }
        
        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic phrase');
        }
        
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const root = bip32.fromSeed(seed, bitcoin.networks.litecoin);
        const child = root.derivePath(`m/44'/2'/0'/0/${index}`);
        const { address } = bitcoin.payments.p2pkh({
            pubkey: child.publicKey,
            network: bitcoin.networks.litecoin
        });
        
        return { address, index };
    } catch (err) {
        console.error('LTC Address generation error:', err.message);
        throw err;
    }
}

function generateETHAddress(mnemonic, index) {
    try {
        if (!mnemonic || typeof mnemonic !== 'string') {
            throw new Error('Invalid mnemonic provided');
        }
        
        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error('Invalid mnemonic phrase');
        }
        
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        const child = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
        
        return { address: child.address, index };
    } catch (err) {
        console.error('ETH Address generation error:', err.message);
        throw err;
    }
}

module.exports = { generateLTCAddress, generateETHAddress };
