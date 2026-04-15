const bip39 = require('bip39');
const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
const { ethers } = require('ethers');

const bip32 = BIP32Factory(ecc);

const litecoinNetwork = {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'ltc',
    bip32: { public: 0x019da462, private: 0x019d9cfe },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0
};

let ltcIndex = 0;
let usdcIndex = 0;
const usedAddresses = new Map();

function generateLTCAddress(mnemonic, index) {
    try {
        if (!mnemonic || typeof mnemonic !== 'string') throw new Error('Invalid LTC mnemonic');
        const cleanMnemonic = mnemonic.trim();
        if (!bip39.validateMnemonic(cleanMnemonic)) throw new Error('Invalid LTC mnemonic phrase');
        const seed = bip39.mnemonicToSeedSync(cleanMnemonic);
        const root = bip32.fromSeed(seed, litecoinNetwork);
        const child = root.derivePath(`m/44'/2'/0'/0/${index}`);
        const { address } = bitcoin.payments.p2wpkh({ pubkey: child.publicKey, network: litecoinNetwork });
        if (!address) throw new Error('Failed to generate LTC address');
        return { address: address, index: index, privateKey: child.toWIF(litecoinNetwork) };
    } catch (err) {
        console.error('LTC generation error:', err.message);
        throw err;
    }
}

function generateETHAddress(mnemonic, index) {
    try {
        const cleanMnemonic = mnemonic.trim();
        if (!bip39.validateMnemonic(cleanMnemonic)) throw new Error('Invalid USDC mnemonic');
        const seed = bip39.mnemonicToSeedSync(cleanMnemonic);
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        const child = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
        return { address: child.address, index: index, privateKey: child.privateKey };
    } catch (err) {
        console.error('USDC generation error:', err.message);
        throw err;
    }
}

function getNextIndex(type) {
    if (type === 'ltc') return ltcIndex++;
    else if (type === 'usdc') return usdcIndex++;
    return 0;
}

function storeAddress(tradeId, type, addressData) {
    if (!usedAddresses.has(tradeId)) usedAddresses.set(tradeId, {});
    const trade = usedAddresses.get(tradeId);
    trade[type] = addressData;
    usedAddresses.set(tradeId, trade);
    return addressData;
}

function getAddress(tradeId, type) {
    const trade = usedAddresses.get(tradeId);
    return trade ? trade[type] : null;
}

function getTradeAddresses(tradeId) {
    return usedAddresses.get(tradeId) || null;
}

module.exports = { generateLTCAddress, generateETHAddress, getNextIndex, storeAddress, getAddress, getTradeAddresses };
