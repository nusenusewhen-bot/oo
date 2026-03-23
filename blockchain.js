function generateFakeTransaction() {
    // Random USD between 5 and 700
    const usd = Math.floor(Math.random() * 696) + 5;
    const ltcPrice = 55.57;
    const ltc = (usd / ltcPrice).toFixed(8);
    
    // Random currency
    const isUSDC = Math.random() > 0.5;
    const currency = isUSDC ? 'USDC' : 'LTC';
    const amount = isUSDC ? usd.toFixed(2) : ltc;
    
    // Generate random TXID
    const chars = '0123456789abcdef';
    let txid = '';
    for (let i = 0; i < 64; i++) txid += chars[Math.floor(Math.random() * 16)];
    
    // Truncate for display
    const shortTxid = `${txid.slice(0, 10)}...${txid.slice(-10)}`;

    return {
        amount: amount,
        usd: usd,
        currency: currency,
        txid: shortTxid,
        fullTxid: txid,
        sender: 'Anonymous',
        receiver: 'Anonymous'
    };
}

module.exports = { generateFakeTransaction };
