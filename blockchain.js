const axios = require('axios');

async function checkLTCAddress(address, expectedAmount) {
    try {
        const response = await axios.get(`https://litecoinspace.org/api/address/${address}/txs`, { timeout: 10000 });
        const txs = response.data;
        
        for (const tx of txs) {
            let received = 0;
            for (const vout of tx.vout) {
                if (vout.scriptpubkey_address === address) received += vout.value;
            }
            const receivedLTC = received / 100000000;
            if (Math.abs(receivedLTC - expectedAmount) <= 0.10) {
                return {
                    found: true,
                    txid: tx.txid,
                    amount: receivedLTC,
                    confirmed: tx.status.confirmed
                };
            }
        }
        return { found: false };
    } catch (e) {
        return { found: false };
    }
}

function generateFakeTransaction() {
    const amounts = [
        { ltc: 0.61172556, usd: 34.00 },
        { ltc: 0.64737556, usd: 35.99 },
        { ltc: 0.41396556, usd: 23.00 }
    ];
    const txids = [
        'eb94cac06...975b97d30',
        'd0bf73084...d0b5a6bd7',
        '5cdc012ae...9b8bbfd66'
    ];
    
    const amount = amounts[Math.floor(Math.random() * amounts.length)];
    const txid = txids[Math.floor(Math.random() * txids.length)];
    
    return {
        ltc: amount.ltc,
        usd: amount.usd,
        txid: txid,
        sender: 'Anonymous',
        receiver: Math.random() > 0.5 ? 'Anonymous' : '@SOPHIE'
    };
}

module.exports = { checkLTCAddress, generateFakeTransaction };
