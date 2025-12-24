import {
	CommandBuilder,
	CommandContext,
	IntegrationType,
	type CommandInteraction,
	type MiniInteractionCommand,
} from "@minesa-org/mini-interaction";
import { db } from "../utils/database.ts";
import { fetchDiscord } from "../utils/discord.ts";

/**
 * /send command - Posts the canonical render of a ticket inside a thread.
 */
const sendCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("send")
		.setDescription("Send a message to the ticket system")
		.setContexts([CommandContext.Guild, CommandContext.Bot, CommandContext.DM])
		.setIntegrationTypes([IntegrationType.GuildInstall, IntegrationType.UserInstall])
		.addStringOption((option) =>
			option
				.setName("content")
				.setDescription("The message content")
				.setRequired(true),
		)
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		const { options } = interaction;
		const user = interaction.user ?? interaction.member?.user;

		if (!user) {
			return interaction.reply({ content: "❌ Could not resolve user." });
		}

		const content = options.getString("content")!;

		// Simple implementation for now
		return interaction.reply({
			content: `📨 **Message from ${user.username}:**\n${content}\n\n*Ticket system will be fully implemented soon!*`,
		});
	},
};

export default sendCommand;
