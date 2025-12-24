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

		const userData = await db.get(user.id);
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

			return interaction.reply({
				content:
					"⚠️ You need to authorize the app first to see your mutual servers.",
				components: [button],
			});
		}

		try {
			const userGuilds = await fetchDiscord(
				"/users/@me/guilds",
				userData.accessToken as string,
			);

			const botGuildsData: any = await db.get("cache:bot_guilds");
			let botGuilds: any[] = botGuildsData?.guilds || [];

			if (
				!botGuilds.length ||
				(botGuildsData?.cachedAt || 0) < Date.now() - 300000
			) {
				botGuilds = await fetchDiscord(
					"/users/@me/guilds",
					process.env.DISCORD_BOT_TOKEN!,
					true,
				);
				await db.set("cache:bot_guilds", {
					guilds: botGuilds,
					cachedAt: Date.now(),
				});
			}

			const mutualGuilds = userGuilds.filter((ug: any) =>
				botGuilds.some((bg: any) => bg.id === ug.id),
			);

			if (mutualGuilds.length === 0) {
				return interaction.reply({
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
