const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { loadCommands } = require('./commands');
const { loadHandlers } = require('./handlers');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

client.config = {
    OWNER_ROLE_ID: '1484684261804998879',
    HITTER_ROLE_ID: '1484680314772000902',
    WALLET_1: process.env.WALLET_1,
    WALLET_2: process.env.WALLET_2,
    GUILD_ID: null,
    TICKET_CATEGORY: null,
    LOG_CHANNEL: null
};

client.activeTickets = new Map();
client.ticketAddresses = new Map();
client.ticketRoles = new Map();
client.userWallets = new Map();
client.ltcPrice = 55.57;

// Validate env vars
if (!client.config.WALLET_1) {
    console.error('❌ WALLET_1 (LTC mnemonic) not set in environment variables!');
    process.exit(1);
}
if (!client.config.WALLET_2) {
    console.error('❌ WALLET_2 (ETH/USDT mnemonic) not set in environment variables!');
    process.exit(1);
}

console.log('✅ Wallets configured');
console.log('WALLET_1 length:', client.config.WALLET_1.length);
console.log('WALLET_2 length:', client.config.WALLET_2.length);

loadCommands(client);
loadHandlers(client);

client.once(Events.ClientReady, () => {
    console.log(`Bot logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
