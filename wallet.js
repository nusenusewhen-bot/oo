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
    try {
        const { BIP32Factory } = require('bip32');
        const ecc = require('tiny-secp256k1');
        bip32 = BIP32Factory(ecc);
    } catch (err2) {
        console.error('Failed to load bip32:', err2.message);
        throw err2;
    }
}

function generateLTCAddress(mnemonic, index) {
    try {
        if (!mnemonic || typeof mnemonic !== 'string') {
            throw new Error('Invalid mnemonic provided');
        }
        
        // Validate mnemonic
        if (!bip39.validateMnemonic(mnemonic.trim())) {
            throw new Error('Invalid mnemonic phrase - must be 12 or 24 words');
        }
        
        const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
        const root = bip32.fromSeed(seed, bitcoin.networks.litecoin);
        const child = root.derivePath(`m/44'/2'/0'/0/${index}`);
        
        // Try p2wpkh first (ltc1 addresses)
        try {
            const p2wpkh = bitcoin.payments.p2wpkh({
                pubkey: child.publicKey,
                network: bitcoin.networks.litecoin
            });
            if (p2wpkh.address) {
                return { address: p2wpkh.address, index, privateKey: child.toWIF() };
            }
        } catch (e) {
            // Fallback to p2sh-p2wpkh
            const p2sh = bitcoin.payments.p2sh({
                redeem: bitcoin.payments.p2wpkh({
                    pubkey: child.publicKey,
                    network: bitcoin.networks.litecoin
                }),
                network: bitcoin.networks.litecoin
            });
            if (p2sh.address) {
                return { address: p2sh.address, index, privateKey: child.toWIF() };
            }
        }
        
        // Final fallback to legacy
        const legacy = bitcoin.payments.p2pkh({
            pubkey: child.publicKey,
            network: bitcoin.networks.litecoin
        });
        return { address: legacy.address, index, privateKey: child.toWIF() };
        
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
        
        if (!bip39.validateMnemonic(mnemonic.trim())) {
            throw new Error('Invalid mnemonic phrase');
        }
        
        const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        const child = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
        
        return { address: child.address, index, privateKey: child.privateKey };
    } catch (err) {
        console.error('ETH Address generation error:', err.message);
        throw err;
    }
}

module.exports = { generateLTCAddress, generateETHAddress };
