import {
	ActionRowBuilder,
	CommandBuilder,
	CommandContext,
	IntegrationType,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	type MiniComponentMessageActionRow,
	type CommandInteraction,
	type MiniInteractionCommand,
} from "@minesa-org/mini-interaction";
import { db } from "../utils/database.js";
import { fetchDiscord } from "../utils/discord.js";

/**
 * /create command - Allows user to select a mutual server to create a ticket thread.
 */
const createCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("create")
		.setDescription("Create a ticket thread in a mutual server")
		.setContexts([
			CommandContext.Guild,
			CommandContext.Bot,
			CommandContext.DM,
		])
		.setIntegrationTypes([
			IntegrationType.GuildInstall,
			IntegrationType.UserInstall,
		])
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		const user = interaction.user ?? interaction.member?.user;

		if (!user) {
			return interaction.reply({ content: "❌ Could not resolve user." });
		}

		// 1. Get user tokens from DB
		const userData = await db.get(user.id);
		if (!userData || !userData.accessToken) {
			return interaction.reply({
				content:
					"⚠️ You need to authorize the app first to see your mutual servers.",
				components: [
					// Note: You should add a button here with a link to your OAuth URL
				] as any,
			});
		}

		try {
			// 2. Fetch User Guilds and Bot Guilds
			// For production, consider caching these lists.
			const [userGuilds, botGuilds] = await Promise.all([
				fetchDiscord(
					"/users/@me/guilds",
					userData.accessToken as string,
				),
				fetchDiscord(
					"/users/@me/guilds",
					process.env.DISCORD_BOT_TOKEN!,
					true,
				),
			]);

			const mutualGuilds = userGuilds.filter((ug: any) =>
				botGuilds.some((bg: any) => bg.id === ug.id),
			);

			if (mutualGuilds.length === 0) {
				return interaction.reply({
					content:
						"❌ No mutual servers found. Make sure the bot is invited to the servers you are in.",
				});
			}

			// 3. Build Select Menu
			const menu = new ActionRowBuilder<MiniComponentMessageActionRow>()
				.addComponents(
					new StringSelectMenuBuilder()
						.setCustomId("create:select_server")
						.setPlaceholder("Select a server to create a thread")
						.addOptions(
							mutualGuilds
								.slice(0, 25)
								.map((guild: any) =>
									new StringSelectMenuOptionBuilder()
										.setLabel(guild.name)
										.setValue(guild.id),
								),
						),
				)
				.toJSON();

			return interaction.reply({
				content:
					"Please select a server where you want to create a ticket thread:",
				components: [menu],
			});
		} catch (error) {
			console.error("Error in /create command:", error);
			return interaction.reply({
				content:
					"❌ An error occurred while fetching your servers. Please try again later.",
			});
		}
	},
};

export default createCommand;
