const { JsonDB, Config } = require('node-json-db');
const path = require('path');

const db = new JsonDB(new Config(path.join(__dirname, 'trades.json'), true, true, '/'));

// Wrapper to match better-sqlite3 API
const dbWrapper = {
  prepare: (sql) => {
    return {
      get: async (...params) => {
        try {
          if (sql.includes('FROM config WHERE key')) {
            const data = await db.getData('/config');
            return data.find(x => x.key === params[0]);
          }
          if (sql.includes('FROM whitelist WHERE userId')) {
            const data = await db.getData('/whitelist');
            return data.find(x => x.userId === params[0]);
          }
          if (sql.includes('FROM trades WHERE id')) {
            const data = await db.getData('/trades');
            const trade = data.find(x => x.id === params[0]);
            return trade || undefined;
          }
          return undefined;
        } catch (e) { return undefined; }
      },
      all: async () => {
        try {
          if (sql.includes('FROM config')) return await db.getData('/config') || [];
          if (sql.includes('FROM trades')) return await db.getData('/trades') || [];
          return [];
        } catch (e) { return []; }
      },
      run: async (...params) => {
        try {
          if (sql.includes('INSERT OR REPLACE INTO config')) {
            let data = [];
            try { data = await db.getData('/config'); } catch (e) {}
            const idx = data.findIndex(x => x.key === params[0]);
            if (idx >= 0) data[idx].value = params[1];
            else data.push({ key: params[0], value: params[1] });
            await db.push('/config', data);
            return { lastInsertRowid: 1, changes: 1 };
          }
          if (sql.includes('INSERT OR REPLACE INTO whitelist')) {
            let data = [];
            try { data = await db.getData('/whitelist'); } catch (e) {}
            if (!data.find(x => x.userId === params[0])) data.push({ userId: params[0] });
            await db.push('/whitelist', data);
            return { lastInsertRowid: 1, changes: 1 };
          }
          if (sql.includes('INSERT INTO trades')) {
            let data = [];
            try { data = await db.getData('/trades'); } catch (e) {}
            const id = Date.now();
            data.push({
              id: id,
              channelId: params[0],
              user1Id: params[1],
              user2Id: params[2],
              senderId: params[3],
              receiverId: params[4],
              amount: params[5],
              status: params[6],
              type: params[7],
              fee: 0,
              ltcPrice: 0,
              totalLtc: 0,
              ltcAddress: null,
              txid: null,
              createdAt: new Date().toISOString()
            });
            await db.push('/trades', data);
            return { lastInsertRowid: id, changes: 1 };
          }
          if (sql.includes('INSERT INTO addresses')) {
            let data = [];
            try { data = await db.getData('/addresses'); } catch (e) {}
            data.push({
              tradeId: params[0],
              addressType: params[1],
              address: params[2],
              indexNum: params[3],
              privateKey: params[4]
            });
            await db.push('/addresses', data);
            return { lastInsertRowid: 1, changes: 1 };
          }
          if (sql.includes('UPDATE trades SET')) {
            let data = [];
            try { data = await db.getData('/trades'); } catch (e) {}
            const idx = data.findIndex(x => x.id === params[params.length - 1]);
            if (idx >= 0) {
              if (sql.includes('senderId = ?')) data[idx].senderId = params[0];
              if (sql.includes('receiverId = ?')) data[idx].receiverId = params[0];
              if (sql.includes('senderId = NULL')) data[idx].senderId = null;
              if (sql.includes('receiverId = NULL')) data[idx].receiverId = null;
              if (sql.includes('amount = ?')) {
                data[idx].amount = params[0];
                data[idx].fee = params[1];
                data[idx].ltcPrice = params[2];
                data[idx].totalLtc = params[3];
              }
              if (sql.includes('status = ?')) data[idx].status = params[0];
              if (sql.includes('ltcAddress = ?')) data[idx].ltcAddress = params[0];
              if (sql.includes('txid = ?')) data[idx].txid = params[0];
              await db.push('/trades', data);
            }
            return { changes: 1 };
          }
          return { changes: 0 };
        } catch (e) {
          console.error('DB Error:', e);
          return { changes: 0 };
        }
      }
    };
  },
  exec: async () => {
    try {
      await db.push('/config', []);
      await db.push('/whitelist', []);
      await db.push('/trades', []);
      await db.push('/addresses', []);
    } catch (e) {}
  }
};

// Initialize
(async () => {
  try {
    await db.push('/config', [], true);
    await db.push('/whitelist', [], true);
    await db.push('/trades', [], true);
    await db.push('/addresses', [], true);
  } catch (e) {}
})();

module.exports = dbWrapper;
