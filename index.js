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

// Specific authorized users
const PANEL_USERS = ['1485157636222750801', '1422945082746601594'];
const HITTER_ROLE_ID = '1484680314772000902';
const FINANCE_ROLE_ID = '1485363449897681017';

client.config = {
    OWNER_ROLE_ID: '1484229121134297306',
    HITTER_ROLE_ID: HITTER_ROLE_ID,
    FINANCE_ROLE_ID: FINANCE_ROLE_ID,
    PANEL_USERS: PANEL_USERS,
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
if (!client.config.WALLET_1 || !client.config.WALLET_2) {
    console.error('❌ Missing WALLET_1 or WALLET_2 environment variables!');
    process.exit(1);
}

loadCommands(client);
loadHandlers(client);

client.once(Events.ClientReady, () => {
    console.log(`Bot logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
