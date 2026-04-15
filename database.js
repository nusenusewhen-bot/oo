const Database = require('better-sqlite3');
const db = new Database('./trades.db');

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS whitelist (userId TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channelId TEXT,
    user1Id TEXT,
    user2Id TEXT,
    senderId TEXT,
    receiverId TEXT,
    amount REAL DEFAULT 0,
    fee REAL DEFAULT 0,
    ltcPrice REAL DEFAULT 0,
    totalLtc REAL DEFAULT 0,
    status TEXT DEFAULT 'role_selection',
    type TEXT DEFAULT 'ltc',
    ltcAddress TEXT,
    txid TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tradeId INTEGER,
    addressType TEXT,
    address TEXT UNIQUE,
    indexNum INTEGER,
    privateKey TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tradeId) REFERENCES trades(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_trades_channelId ON trades(channelId);
  CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
  CREATE INDEX IF NOT EXISTS idx_trades_senderId ON trades(senderId);
  CREATE INDEX IF NOT EXISTS idx_trades_user1Id ON trades(user1Id);
  CREATE INDEX IF NOT EXISTS idx_trades_user2Id ON trades(user2Id);
  CREATE INDEX IF NOT EXISTS idx_trades_type ON trades(type);
  CREATE INDEX IF NOT EXISTS idx_config_key ON config(key);
  CREATE INDEX IF NOT EXISTS idx_addresses_tradeId ON addresses(tradeId);
  CREATE INDEX IF NOT EXISTS idx_addresses_address ON addresses(address);
`);

try { db.exec(`ALTER TABLE trades ADD COLUMN type TEXT DEFAULT 'ltc'`); } catch (e) {}
try { db.exec(`ALTER TABLE trades ADD COLUMN ltcAddress TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE trades ADD COLUMN txid TEXT`); } catch (e) {}

module.exports = db;
