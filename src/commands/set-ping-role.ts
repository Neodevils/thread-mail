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
		const guild = interaction.guild;
		const roleId = interaction.options.getRole("role")?.id;

		try {
			// Get existing guild data or create new
			let guildData = await db.get(`guild:${guild!.id}`);
			if (!guildData) {
				guildData = {
					guildId: guild!.id,
				};
			}

			// Update with ping role
			guildData.pingRoleId = roleId;

			// Clean up any timestamp fields that might cause conflicts
			// MiniDatabase automatically handles createdAt/updatedAt timestamps
			const cleanGuildData = { ...guildData };
			delete cleanGuildData.createdAt;
			delete cleanGuildData.updatedAt;

			await db.set(`guild:${guild!.id}`, cleanGuildData);

			return interaction.reply({
				content: `✅ Successfully set <@&${roleId}> as the role to ping when new ticket threads are created in this server.`,
				flags: [InteractionReplyFlags.Ephemeral],
			});
		} catch (error) {
			console.error("Error setting ping role:", error);
			return interaction.reply({
				content:
					"<:Oops:1453370232277307474> Failed to set ping role. Please try again.",
				flags: [InteractionReplyFlags.Ephemeral],
			});
		}
	},
};

export default setPingRoleCommand;
