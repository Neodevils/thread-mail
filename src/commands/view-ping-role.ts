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

const viewPingRoleCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("view-ping-role")
		.setDescription("View or clear the role that gets pinged for new ticket threads")
		.setContexts([CommandContext.Guild])
		.setIntegrationTypes([IntegrationType.GuildInstall])
		.setDefaultMemberPermissions(MiniPermFlags.ManageGuild)
		.addStringOption((option) =>
			option
				.setName("action")
				.setDescription("Action to perform")
				.setRequired(false)
				.addChoices(
					{ name: "view_role", value: "view" },
					{ name: "clear_role", value: "clear" },
				),
		)
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		const user = interaction.user ?? interaction.member?.user;
		const guild = interaction.guild;
		const action = interaction.options.getString("action");

		if (!user) {
			return interaction.reply({
				content: "<:Oops:1453370232277307474> Could not resolve user.",
				flags: [InteractionReplyFlags.Ephemeral],
			});
		}

		if (!guild) {
			return interaction.reply({
				content: "<:Oops:1453370232277307474> This command can only be used in a server.",
				flags: [InteractionReplyFlags.Ephemeral],
			});
		}

		try {
			const guildData = await db.get(`guild:${guild.id}`);

			if (action === "clear") {
				if (guildData && guildData.pingRoleId) {
					delete guildData.pingRoleId;
					await db.set(`guild:${guild.id}`, guildData);

					return interaction.reply({
						content: "✅ Successfully cleared the ping role. New threads will now ping @here.",
						flags: [InteractionReplyFlags.Ephemeral],
					});
				} else {
					return interaction.reply({
						content: "<:Oops:1453370232277307474> No ping role is currently set for this server.",
						flags: [InteractionReplyFlags.Ephemeral],
					});
				}
			}

			// Default action: view current role
			if (guildData && guildData.pingRoleId) {
				return interaction.reply({
					content: `📢 Current ping role: <@&${guildData.pingRoleId}>\n\nUse \`/set-ping-role\` to change it or \`/view-ping-role action:clear\` to remove it.`,
					flags: [InteractionReplyFlags.Ephemeral],
				});
			} else {
				return interaction.reply({
					content: "📢 No custom ping role is set for this server. New threads will ping @here.\n\nUse `/set-ping-role` to set a custom role.",
					flags: [InteractionReplyFlags.Ephemeral],
				});
			}
		} catch (error) {
			console.error("Error managing ping role:", error);
			return interaction.reply({
				content:
					"<:Oops:1453370232277307474> Failed to manage ping role. Please try again.",
				flags: [InteractionReplyFlags.Ephemeral],
			});
		}
	},
};

export default viewPingRoleCommand;
