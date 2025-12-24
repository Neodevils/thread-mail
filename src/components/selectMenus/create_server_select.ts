import {
	type MiniInteractionComponent,
	type StringSelectInteraction,
} from "@minesa-org/mini-interaction";
import { fetchDiscord } from "../../utils/discord.js";

const createServerSelect: MiniInteractionComponent = {
	customId: "create:select_server",

	handler: async (interaction: StringSelectInteraction) => {
		const selectedServerId = interaction.getStringValues()[0];

		if (!selectedServerId) {
			return interaction.reply({
				content: "❌ No server selected.",
				ephemeral: true,
			});
		}

		try {
			// Get guild information to find system channel
			const guild = await fetchDiscord(`/guilds/${selectedServerId}`, process.env.DISCORD_BOT_TOKEN!, true);

			if (!guild.system_channel_id) {
				return interaction.reply({
					content: "❌ This server doesn't have a system channel set up for thread creation.",
					ephemeral: true,
				});
			}

			// Create a private thread in the system channel
			const threadData = {
				name: `Ticket-${interaction.user.username}-${Date.now()}`,
				type: 12, // Private thread
				auto_archive_duration: 1440, // 24 hours
			};

			const thread = await fetchDiscord(
				`/channels/${guild.system_channel_id}/threads`,
				process.env.DISCORD_BOT_TOKEN!,
				true,
				5000,
				{
					method: "POST",
					body: JSON.stringify(threadData),
				}
			);

			// Add the user to the thread
			await fetchDiscord(
				`/channels/${thread.id}/thread-members/${interaction.user.id}`,
				process.env.DISCORD_BOT_TOKEN!,
				true,
				3000,
				{
					method: "PUT",
				}
			);

			return interaction.reply({
				content: `✅ Private thread created successfully in ${guild.name}!\n\nThread: <#${thread.id}>`,
				ephemeral: true,
			});

		} catch (error) {
			console.error("Error creating thread:", error);
			return interaction.reply({
				content: "❌ Failed to create thread. Please try again later.",
				ephemeral: true,
			});
		}
	},
};

export default createServerSelect;
