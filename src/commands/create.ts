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
	InteractionReplyFlags,
	ContainerBuilder,
	SectionBuilder,
	TextDisplayBuilder,
} from "@minesa-org/mini-interaction";
import { db } from "../utils/database.ts";
import { fetchDiscord } from "../utils/discord.ts";

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
		console.log(`[CREATE] Command triggered by user: ${interaction.user?.id}`);

		const user = interaction.user ?? interaction.member?.user;

		if (!user) {
			console.log(`[CREATE] User not found`);
			return interaction.reply({ content: "❌ Could not resolve user." });
		}

		console.log(`[CREATE] User resolved: ${user.id} (${user.username})`);
		const safeUser = user!; // We know user exists after the check

		// Check if user already has an active ticket
		console.log(`[CREATE] Checking for existing tickets...`);
		const userData = await db.get(safeUser.id);
		console.log(`[CREATE] User data:`, userData);

		if (userData && userData.activeTicketId) {
			console.log(`[CREATE] Found active ticket: ${userData.activeTicketId}`);
			const existingTicket = await db.get(
				`ticket:${userData.activeTicketId}`,
			);
			console.log(`[CREATE] Existing ticket data:`, existingTicket);

			if (existingTicket && existingTicket.status === "open") {
				console.log(`[CREATE] User has open ticket, rejecting`);
				return interaction.reply({
					content:
						"❌ You already have an open ticket. Use `/send` command in DMs to communicate with staff.",
					flags: [InteractionReplyFlags.Ephemeral],
				});
			}
		}

		console.log(`[CREATE] No active ticket found, proceeding...`);

		// Reply immediately with @here mention
		console.log(`[CREATE] Sending initial reply`);
		await interaction.reply({
			content: "@here A new ticket request has been made!",
		});
		console.log(`[CREATE] Initial reply sent`);

		// Now check OAuth and show select menu
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
			// Parallel API calls with short timeout
			const [userGuilds, botGuilds] = await Promise.all([
				fetchDiscord(
					"/users/@me/guilds",
					(userData as any).accessToken,
					false,
					1500,
				),
				fetchDiscord(
					"/users/@me/guilds",
					process.env.DISCORD_BOT_TOKEN!,
					true,
					1500,
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
					"@here A new ticket request has been made!\n\nSelect a server to create a support ticket.\n\n-# Use </send:1453302198086664248> command in DMs to communicate with staff.",
				components: [menu],
			});
		} catch (error) {
			console.error("Error in /create command:", error);
			return interaction.editReply({
				content:
					"❌ An error occurred while fetching your servers. Please try again later.",
			});
		}

		try {
			// Fast database check with short timeout
			const dbPromise = db.get(safeUser.id);
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error("Database timeout")), 500);
			});

			const userData = (await Promise.race([
				dbPromise,
				timeoutPromise,
			])) as any;

			if (!userData || !userData.accessToken) {
				const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${
					process.env.DISCORD_APPLICATION_ID
				}&response_type=code&redirect_uri=${encodeURIComponent(
					process.env.DISCORD_REDIRECT_URI!,
				)}&scope=identify+guilds+role_connections.write`;

				const button =
					new ActionRowBuilder<MiniComponentMessageActionRow>()
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

			// Parallel API calls with short timeout
			const [userGuilds, botGuilds] = await Promise.all([
				fetchDiscord(
					"/users/@me/guilds",
					(userData as any).accessToken,
					false,
					1500,
				),
				fetchDiscord(
					"/users/@me/guilds",
					process.env.DISCORD_BOT_TOKEN!,
					true,
					1500,
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

			const menu = new ActionRowBuilder<MiniComponentMessageActionRow>()
				.addComponents(
					new StringSelectMenuBuilder()
						.setCustomId("create:select_server")
						.setPlaceholder("Select a server to create a thread")
						.addOptions(
							...mutualGuilds
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
