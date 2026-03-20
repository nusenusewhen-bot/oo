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
    OWNER_ROLE_ID: '1483830222045577340',
    HITTER_ROLE_ID: '1483830341142577356',
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

loadCommands(client);
loadHandlers(client);

client.once(Events.ClientReady, () => {
    console.log(`Bot logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
