const { QuickDB } = require('quick.db');
const db = new QuickDB();

// Table references
const configTable = db.table('config');
const whitelistTable = db.table('whitelist');
const tradesTable = db.table('trades');
const addressesTable = db.table('addresses');

// Wrapper to match better-sqlite3 API
const dbWrapper = {
  prepare: (sql) => {
    const isSelect = sql.trim().toLowerCase().startsWith('select');
    const isInsert = sql.includes('INSERT');
    
    return {
      get: async (...params) => {
        if (sql.includes('FROM config')) {
          const key = params[0];
          const val = await configTable.get(key);
          return val ? { key, value: val } : undefined;
        }
        if (sql.includes('FROM whitelist')) {
          const userId = params[0];
          const val = await whitelistTable.get(userId);
          return val ? { userId } : undefined;
        }
        if (sql.includes('FROM trades WHERE id')) {
          return await tradesTable.get(params[0]);
        }
        return undefined;
      },
      all: async (...params) => {
        if (sql.includes('FROM config')) {
          const all = await configTable.all();
          return Object.entries(all).map(([key, value]) => ({ key, value }));
        }
        if (sql.includes('FROM trades')) {
          const all = await tradesTable.all();
          return Object.entries(all).map(([id, data]) => ({ id: parseInt(id), ...data }));
        }
        return [];
      },
      run: async (...params) => {
        if (sql.includes('INSERT OR REPLACE INTO config')) {
          await configTable.set(params[0], params[1]);
          return { lastInsertRowid: 1, changes: 1 };
        }
        if (sql.includes('INSERT OR REPLACE INTO whitelist')) {
          await whitelistTable.set(params[0], true);
          return { lastInsertRowid: 1, changes: 1 };
        }
        if (sql.includes('INSERT INTO trades')) {
          const id = Date.now();
          const data = {
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
          };
          await tradesTable.set(id.toString(), data);
          return { lastInsertRowid: id, changes: 1 };
        }
        if (sql.includes('INSERT INTO addresses')) {
          await addressesTable.set(params[2], {
            tradeId: params[0],
            addressType: params[1],
            address: params[2],
            indexNum: params[3],
            privateKey: params[4]
          });
          return { lastInsertRowid: 1, changes: 1 };
        }
        if (sql.includes('UPDATE trades SET')) {
          const id = params[params.length - 1];
          const existing = await tradesTable.get(id.toString()) || {};
          let updates = {};
          
          if (sql.includes('senderId')) updates.senderId = params[0];
          if (sql.includes('receiverId')) updates.receiverId = params[0];
          if (sql.includes('senderId = NULL')) updates.senderId = null;
          if (sql.includes('receiverId = NULL')) updates.receiverId = null;
          if (sql.includes('amount = ?')) {
            updates.amount = params[0];
            updates.fee = params[1];
            updates.ltcPrice = params[2];
            updates.totalLtc = params[3];
          }
          if (sql.includes('status')) updates.status = params[0];
          if (sql.includes('ltcAddress')) updates.ltcAddress = params[0];
          if (sql.includes('txid')) updates.txid = params[0];
          
          await tradesTable.set(id.toString(), { ...existing, ...updates });
          return { changes: 1 };
        }
        return { changes: 0 };
      }
    };
  },
  exec: async (sql) => {
    // Tables created automatically by QuickDB
    return;
  }
};

module.exports = dbWrapper;
