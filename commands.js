const { SlashCommandBuilder, PermissionsBitField, Events } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Spawn the middleman panels (Owner only)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
    new SlashCommandBuilder()
        .setName('log')
        .setDescription('Set the fake transaction log channel (Owner only)')
        .addChannelOption(opt => 
            opt.setName('channel')
               .setDescription('Channel for fake logs')
               .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
    new SlashCommandBuilder()
        .setName('transaction')
        .setDescription('Trigger fake transaction (Hitter only)')
        .addStringOption(opt => 
            opt.setName('channelid')
               .setDescription('Ticket channel ID')
               .setRequired(true)
        ),
    
    new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close the current ticket'),
    
    new SlashCommandBuilder()
        .setName('heh')
        .setDescription('Set closed ticket monitor channel (Owner only)')
        .addStringOption(opt => 
            opt.setName('channelid')
               .setDescription('Channel ID')
               .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
    new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Set ticket category (Owner only)')
        .addStringOption(opt => 
            opt.setName('categoryid')
               .setDescription('Category ID')
               .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
    // New commands
    new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check bot balance in this ticket (Hitter+ only)'),
    
    new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send LTC from bot (Owner only)')
        .addStringOption(opt => opt.setName('address').setDescription('LTC address').setRequired(true))
        .addNumberOption(opt => opt.setName('amount').setDescription('Amount in LTC').setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
    new SlashCommandBuilder()
        .setName('split')
        .setDescription('Split balance 50/50 between two addresses (Owner only)')
        .addStringOption(opt => opt.setName('address1').setDescription('First address (50%)').setRequired(true))
        .addStringOption(opt => opt.setName('address2').setDescription('Second address (50%)').setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

function loadCommands(client) {
    client.on(Events.GuildCreate, async (guild) => {
        client.config.GUILD_ID = guild.id;
        try {
            await guild.commands.set(commands);
            console.log(`Commands registered in ${guild.name}`);
        } catch (err) {
            console.error('Failed to register commands:', err);
        }
    });
    
    client.on(Events.ClientReady, async () => {
        const guilds = client.guilds.cache;
        for (const [, guild] of guilds) {
            try {
                await guild.commands.set(commands);
            } catch (err) {
                console.error(`Failed to register commands in ${guild.name}:`, err);
            }
        }
    });
}

module.exports = { loadCommands };
