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
	TextDisplayBuilder,
} from "@minesa-org/mini-interaction";
import { db } from "../utils/database.ts";
import { fetchDiscord } from "../utils/discord.ts";

const createCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("create")
		.setDescription("Create a ticket thread in a mutual server")
		.setContexts([CommandContext.Bot])
		.setIntegrationTypes([IntegrationType.UserInstall])
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		const user = interaction.user ?? interaction.member?.user;

		if (!user) {
			return interaction.reply({
				content: "<:Oops:1453370232277307474> Could not resolve user.",
				flags: [InteractionReplyFlags.Ephemeral],
			});
		}

		// Check cooldown (30 minutes)
		const cooldownKey = `cooldown:create:${user.id}`;
		const now = Date.now();
		const cooldownDuration = 30 * 60 * 1000; // 30 minutes in milliseconds

		try {
			const lastUsed = (await db.get(cooldownKey)) as {
				timestamp: number;
			} | null;
			if (
				lastUsed &&
				lastUsed.timestamp &&
				now - lastUsed.timestamp < cooldownDuration
			) {
				const availableAt = lastUsed.timestamp + cooldownDuration;
				return interaction.reply({
					content: `<:Oops:1453370232277307474> You can only use this command once every 30 minutes. Try again <t:${Math.floor(
						availableAt / 1000,
					)}:R>.`,
					flags: [InteractionReplyFlags.Ephemeral],
				});
			}
		} catch (error) {
			console.error("Error checking cooldown:", error);
		}

		let userTicketData;
		try {
			userTicketData = await db.get(`user:${user.id}`);
		} catch (dbError) {
			console.error("Database error getting user ticket data:", dbError);
			userTicketData = null; // Skip ticket check if database fails
		}

		if (userTicketData && userTicketData.activeTicketId) {
			let existingTicket;
			try {
				existingTicket = await db.get(
					`ticket:${userTicketData.activeTicketId}`,
				);
			} catch (dbError) {
				console.error("Database error getting ticket data:", dbError);
				existingTicket = null; // Skip ticket check if database fails
			}

			if (existingTicket && existingTicket.status === "open") {
				return interaction.reply({
					components: [
						new ContainerBuilder()
							.addComponent(
								new TextDisplayBuilder().setContent(
									"## <:Oops:1453370232277307474> You already have an open ticket!",
								),
							)
							.addComponent(
								new TextDisplayBuilder().setContent(
									"Please use </send:1453302198086664248> command in DMs to communicate with staff.",
								),
							)
							.toJSON(),
					],
					flags: [
						InteractionReplyFlags.IsComponentsV2,
						InteractionReplyFlags.Ephemeral,
					],
				});
			}
		}

		let userData;
		try {
			userData = await db.get(user.id);
		} catch (dbError) {
			console.error("Database error getting user data:", dbError);
			userData = null; // Treat as unauthorized if database fails
		}

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
					"⚠️ You have not authorized your account with the app. Use `/authorize-account` command to authorize.",
				components: [
					new ContainerBuilder()
						.addComponent(
							new TextDisplayBuilder().setContent(
								"## <:sharedwithu:1453370234114150542> Authorization Required",
							),
						)
						.addComponent(
							new TextDisplayBuilder().setContent(
								"You have not authorized your account with the app. Use `/authorize-account` command to authorize.",
							),
						)
						.addComponent(button)
						.toJSON(),
				],
				flags: [InteractionReplyFlags.IsComponentsV2],
			});
		}

		try {
			// First, try to fetch user guilds to check if token is valid
			let userGuilds;
			try {
				userGuilds = await fetchDiscord(
					"/users/@me/guilds",
					userData.accessToken as string,
					false,
					1500,
				);
			} catch (userError) {
				// If user token is invalid (401), show authorization prompt
				if (
					userError instanceof Error &&
					userError.message.includes("401")
				) {
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
							"⚠️ Your authorization has expired. Use `/authorize-account` command to re-authorize.",
						components: [
							new ContainerBuilder()
								.addComponent(
									new TextDisplayBuilder().setContent(
										"## <:sharedwithu:1453370234114150542> Re-authorization Required",
									),
								)
								.addComponent(
									new TextDisplayBuilder().setContent(
										"Your authorization has expired. Use `/authorize-account` command to re-authorize.",
									),
								)
								.addComponent(button)
								.toJSON(),
						],
						flags: [InteractionReplyFlags.IsComponentsV2],
					});
				}
				// Re-throw other user API errors
				throw userError;
			}

			// If user token is valid, fetch bot guilds
			const botGuilds = await fetchDiscord(
				"/users/@me/guilds",
				process.env.DISCORD_BOT_TOKEN!,
				true,
				1500,
			);

			const mutualGuilds = userGuilds.filter((ug: any) =>
				botGuilds.some((bg: any) => bg.id === ug.id),
			);

			if (mutualGuilds.length === 0) {
				return interaction.reply({
					content:
						"<:Oops:1453370232277307474> No mutual servers found. Make sure the bot is invited to the servers you are in.",
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

			// Set cooldown after successful command execution
			try {
				await db.set(cooldownKey, { timestamp: now });
			} catch (error) {
				console.error("Error setting cooldown:", error);
				// Don't fail the command if cooldown setting fails
			}

			return interaction.reply({
				components: [
					new ContainerBuilder()
						.addComponent(
							new TextDisplayBuilder().setContent(
								"## <:thread_create:1453370244054777917> Creating a ticketmail",
							),
						)
						.addComponent(
							new TextDisplayBuilder().setContent(
								"Please select a server where you want to create a ticketmail from the dropdown below.",
							),
						)
						.addComponent(menu)
						.toJSON(),
				],
				flags: [InteractionReplyFlags.IsComponentsV2],
			});
		} catch (error) {
			console.error("Error in /create command:", error);
			return interaction.reply({
				content:
					"<:Oops:1453370232277307474> An error occurred while fetching your servers. Please try again later.",
				flags: [InteractionReplyFlags.Ephemeral],
			});
		}
	},
};

export default createCommand;
