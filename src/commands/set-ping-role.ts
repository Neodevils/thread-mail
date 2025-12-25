import {
	CommandBuilder,
	CommandContext,
	IntegrationType,
	InteractionReplyFlags,
	MiniPermFlags,
	type CommandInteraction,
	type MiniInteractionCommand,
} from "@minesa-org/mini-interaction";
import { db } from "../utils/database.ts";

const setPingRoleCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("set-ping-role")
		.setDescription(
			"Set a role to ping when new ticket threads are created",
		)
		.setContexts([CommandContext.Guild])
		.setIntegrationTypes([IntegrationType.GuildInstall])
		.setDefaultMemberPermissions(MiniPermFlags.ManageGuild)
		.addRoleOption((option) =>
			option
				.setName("role")
				.setDescription("The role to ping when new threads are created")
				.setRequired(true),
		)
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		// First, acknowledge the interaction within 3 seconds
		await interaction.deferReply({
			flags: [InteractionReplyFlags.Ephemeral],
		});

		const user = interaction.user ?? interaction.member?.user;
		const guild = interaction.guild;
		const roleId = interaction.options.getRole("role")?.id;

		if (!user) {
			return interaction.editReply({
				content: "<:Oops:1453370232277307474> Could not resolve user.",
			});
		}

		if (!guild) {
			return interaction.editReply({
				content:
					"<:Oops:1453370232277307474> This command can only be used in a server.",
			});
		}

		if (!roleId) {
			return interaction.editReply({
				content:
					"<:Oops:1453370232277307474> Please specify a role to ping.",
			});
		}

		try {
			// Get existing guild data or create new
			let guildData = await db.get(`guild:${guild.id}`);
			if (!guildData) {
				guildData = {
					guildId: guild.id,
				};
			}

			// Update with ping role
			guildData.pingRoleId = roleId;
			await db.set(`guild:${guild.id}`, guildData);

			return interaction.editReply({
				content: `✅ Successfully set <@&${roleId}> as the role to ping when new ticket threads are created in this server.`,
			});
		} catch (error) {
			console.error("Error setting ping role:", error);
			return interaction.editReply({
				content:
					"<:Oops:1453370232277307474> Failed to set ping role. Please try again.",
			});
		}
	},
};

export default setPingRoleCommand;
