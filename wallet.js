const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const { ethers } = require('ethers');

function generateLTCAddress(mnemonic, index) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.BIP32.fromSeed(seed, bitcoin.networks.litecoin);
    const child = root.derivePath(`m/44'/2'/0'/0/${index}`);
    const { address } = bitcoin.payments.p2pkh({ 
        pubkey: child.publicKey,
        network: bitcoin.networks.litecoin 
    });
    return { address, index };
}

function generateETHAddress(mnemonic, index) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdNode = ethers.HDNodeWallet.fromSeed(ethers.getBytes(seed));
    const child = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
    return { address: child.address, index };
}

module.exports = { generateLTCAddress, generateETHAddress };
