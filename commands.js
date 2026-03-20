const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Spawn the middleman panels (Owner only)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    new SlashCommandBuilder()
        .setName('log')
        .setDescription('Set the fake transaction log channel (Owner only)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    new SlashCommandBuilder()
        .setName('transaction')
        .setDescription('Trigger fake transaction (Hitter only)')
        .addStringOption(opt => opt.setName('channelid').setDescription('Ticket channel ID').setRequired(true)),
    new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close the current ticket'),
    new SlashCommandBuilder()
        .setName('heh')
        .setDescription('Set closed ticket monitor channel (Owner only)')
        .addStringOption(opt => opt.setName('channelid').setDescription('Channel ID').setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Set ticket category (Owner only)')
        .addStringOption(opt => opt.setName('categoryid').setDescription('Category ID').setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

function loadCommands(client) {
    client.on(Events.GuildCreate, async (guild) => {
        client.config.GUILD_ID = guild.id;
        await guild.commands.set(commands);
    });
}

module.exports = { loadCommands };
