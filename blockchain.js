const axios = require('axios');

async function checkLTCAddress(address, expectedAmount) {
    try {
        // Check confirmed balance first
        const addrResponse = await axios.get(`https://litecoinspace.org/api/address/${address}`, { timeout: 10000 });
        const addrData = addrResponse.data;
        
        // Get confirmed balance (chain_stats)
        const confirmedBalance = addrData.chain_stats?.funded_txo_sum - addrData.chain_stats?.spent_txo_sum || 0;
        const confirmedLTC = confirmedBalance / 100000000;
        
        // If confirmed balance matches expected, return success
        if (Math.abs(confirmedLTC - expectedAmount) <= 0.001 || confirmedLTC >= expectedAmount * 0.95) {
            // Get last transaction
            const txsResponse = await axios.get(`https://litecoinspace.org/api/address/${address}/txs`, { timeout: 10000 });
            const txs = txsResponse.data;
            
            if (txs && txs.length > 0) {
                const lastTx = txs[0];
                let received = 0;
                for (const vout of lastTx.vout) {
                    if (vout.scriptpubkey_address === address) received += vout.value;
                }
                
                return {
                    found: true,
                    txid: lastTx.txid,
                    amount: received / 100000000,
                    confirmed: true,
                    confirmations: lastTx.status?.confirmed ? 1 : 0
                };
            }
        }
        
        return { found: false, confirmedBalance: confirmedLTC };
    } catch (e) {
        console.error('Check LTC error:', e.message);
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
