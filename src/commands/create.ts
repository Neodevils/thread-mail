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
	SectionBuilder,
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

		const userTicketData = await db.get(`user:${user.id}`);
		if (userTicketData && userTicketData.activeTicketId) {
			const existingTicket = await db.get(
				`ticket:${userTicketData.activeTicketId}`,
			);
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
				components: [
					new ContainerBuilder()
						.addComponent(
							new TextDisplayBuilder().setContent(
								"## <:sharedwithu:1453370234114150542> You need to authorize the app first to see your mutual servers.",
							),
						)
						.addComponent(button)
						.toJSON(),
				],
				flags: [InteractionReplyFlags.IsComponentsV2],
			});
		}

		try {
			// Parallel API calls with short timeout
			const [userGuilds, botGuilds] = await Promise.all([
				fetchDiscord(
					"/users/@me/guilds",
					userData.accessToken as string,
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
