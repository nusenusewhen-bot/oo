const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');
const { ethers } = require('ethers');

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
            throw new Error('Invalid mnemonic');
        }
        
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const root = bip32.fromSeed(seed, bitcoin.networks.litecoin);
        const child = root.derivePath(`m/44'/2'/0'/0/${index}`);
        
        // Use p2wpkh for proper LTC addresses (ltc1...)
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: bitcoin.networks.litecoin
        });
        
        return { address: address || child.identifier.toString('hex'), index, privateKey: child.toWIF() };
    } catch (err) {
        console.error('LTC error:', err);
        // Fallback: generate legacy address
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const root = bip32.fromSeed(seed, bitcoin.networks.litecoin);
        const child = root.derivePath(`m/44'/2'/0'/0/${index}`);
        const { address } = bitcoin.payments.p2pkh({
            pubkey: child.publicKey,
            network: bitcoin.networks.litecoin
        });
        return { address, index, privateKey: child.toWIF() };
    }
}

function generateETHAddress(mnemonic, index) {
    try {
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        const child = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
        return { address: child.address, index, privateKey: child.privateKey };
    } catch (err) {
        console.error('ETH error:', err);
        throw err;
    }
}

module.exports = { generateLTCAddress, generateETHAddress };
