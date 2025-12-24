import {
	ActionRowBuilder,
	RoleSelectMenuBuilder,
	type MiniComponentMessageActionRow,
	type MiniInteractionComponent,
} from "@minesa-org/mini-interaction";
import { fetchDiscord } from "../utils/discord.js";
import { db } from "../utils/database.js";

/**
 * Handler for the server selection menu in the /create command.
 */
export const createMenuHandler: MiniInteractionComponent = {
	customId: "create:select_server",
	handler: async (interaction: any) => {
		const guildId = interaction.data.values[0];
		const user = interaction.user ?? interaction.member?.user;

		try {
			// 1. Fetch Guild info to get system_channel_id
			const guild = await fetchDiscord(
				`/guilds/${guildId}`,
				process.env.DISCORD_BOT_TOKEN!,
				true,
			);
			const systemChannelId = guild.system_channel_id;

			if (!systemChannelId) {
				return interaction.reply({
					content:
						"❌ This server does not have a system channel configured. Please create a thread manually or configure a system channel.",
				});
			}

			// 2. Create the thread
			const thread = await fetch(
				`https://discord.com/api/v10/channels/${systemChannelId}/threads`,
				{
					method: "POST",
					headers: {
						Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						name: "ticket-system",
						auto_archive_duration: 10080, // 1 week
						type: 11, // Guild Public Thread
					}),
				},
			).then((res) => res.json());

			// 3. Store the thread info and set up initial guild settings
			await db.set(`guild:${guildId}`, {
				guildId,
				guildName: guild.name,
				systemChannelId,
				threadId: thread.id,
				status: "setup",
			});

			// Store pending guildId for the user to use in the next step
			await db.update(user.id, {
				pendingGuildId: guildId,
			});

			// 4. Respond and ask for staff role
			const roleMenu =
				new ActionRowBuilder<MiniComponentMessageActionRow>()
					.addComponents(
						new RoleSelectMenuBuilder()
							.setCustomId("create:select_staff_role")
							.setPlaceholder("Select the staff role to ping"),
					)
					.toJSON();

			return interaction.reply({
				content: `✅ Thread <#${thread.id}> created in **${guild.name}**!\n\nNow, please select the **Staff Role** that should be pinged when a new ticket is created.`,
				components: [roleMenu],
			});
		} catch (error) {
			console.error("Error in create menu handler:", error);
			return interaction.reply({
				content:
					"❌ Failed to create thread. Check bot permissions in the selected server.",
			});
		}
	},
};
