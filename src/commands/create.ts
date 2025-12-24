import {
	ActionRowBuilder,
	CommandBuilder,
	CommandContext,
	IntegrationType,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ButtonBuilder,
	ButtonStyle,
	type MiniComponentMessageActionRow,
	type CommandInteraction,
	type MiniInteractionCommand,
} from "@minesa-org/mini-interaction";
import { db } from "../utils/database.js";
import { fetchDiscord } from "../utils/discord.js";

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

		// Defer immediately to buy more time
		await interaction.deferReply();

		// Add timeout to database operation
		const dbPromise = db.get(user.id);
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error("Database timeout")), 1000);
		});

		const userData = await Promise.race([dbPromise, timeoutPromise]) as any;

		if (!userData || !userData.accessToken) {
			const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${
				process.env.DISCORD_APPLICATION_ID
			}&response_type=code&redirect_uri=${encodeURIComponent(
				process.env.DISCORD_REDIRECT_URI!,
			)}&scope=identify+guilds+role_connections.write`;

			const button = new ActionRowBuilder<MiniComponentMessageActionRow>()
				.addComponents(
					new ButtonBuilder()
						.setLabel("Authorize App")
						.setStyle(ButtonStyle.Link)
						.setURL(oauthUrl),
				)
				.toJSON();

			return interaction.editReply({
				content:
					"⚠️ You need to authorize the app first to see your mutual servers.",
				components: [button],
			});
		}

		try {
			// Use shorter timeout to stay within Discord's 3-second interaction limit
			const [userGuilds, botGuilds] = await Promise.all([
				fetchDiscord(
					"/users/@me/guilds",
					userData.accessToken as string,
					false,
					2000, // 2 second timeout
				),
				fetchDiscord(
					"/users/@me/guilds",
					process.env.DISCORD_BOT_TOKEN!,
					true,
					2000, // 2 second timeout
				),
			]);

			const mutualGuilds = userGuilds.filter((ug: any) =>
				botGuilds.some((bg: any) => bg.id === ug.id),
			);

			if (mutualGuilds.length === 0) {
				return interaction.editReply({
					content:
						"❌ No mutual servers found. Make sure the bot is invited to the servers you are in.",
				});
			}

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

			return interaction.editReply({
				content:
					"Please select a server where you want to create a ticket thread:",
				components: [menu],
			});
		} catch (error) {
			console.error("Error in /create command:", error);

			let errorMessage =
				"❌ An error occurred while fetching your servers. Please try again later.";

			if (error instanceof Error) {
				if (error.message.includes("timed out") || error.message.includes("timeout")) {
					errorMessage =
						"❌ Server list is taking too long to load. This might be due to API delays. Please try again.";
				} else if (error.message.includes("Database timeout")) {
					errorMessage =
						"❌ Database is responding slowly. Please try again.";
				}
			}

			return interaction.editReply({
				content: errorMessage,
			});
		}
	},
};

export default createCommand;
