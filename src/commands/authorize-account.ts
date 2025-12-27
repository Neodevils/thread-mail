import {
	ActionRowBuilder,
	CommandBuilder,
	CommandContext,
	IntegrationType,
	ButtonBuilder,
	ButtonStyle,
	type MiniComponentMessageActionRow,
	type CommandInteraction,
	type MiniInteractionCommand,
	InteractionReplyFlags,
	ContainerBuilder,
	TextDisplayBuilder,
} from "@minesa-org/mini-interaction";

const authorizeAccountCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("authorize-account")
		.setDescription(
			"Authorize your Discord account to access mutual servers",
		)
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

		const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${
			process.env.DISCORD_APPLICATION_ID
		}&response_type=code&redirect_uri=${encodeURIComponent(
			process.env.DISCORD_REDIRECT_URI!,
		)}&scope=applications.commands+identify+guilds+role_connections.write`;

		const button = new ActionRowBuilder<MiniComponentMessageActionRow>()
			.addComponents(
				new ButtonBuilder()
					.setLabel("Authorize App")
					.setStyle(ButtonStyle.Link)
					.setURL(oauthUrl),
			)
			.toJSON();

		return interaction.reply({
			components: [
				new ContainerBuilder()
					.addComponent(
						new TextDisplayBuilder().setContent(
							"## <:sharedwithu:1453370234114150542> Account Authorization",
						),
					)
					.addComponent(
						new TextDisplayBuilder().setContent(
							"Click the button below to authorize the app and grant access to your Discord account information. This is required to see your mutual servers and create ticket threads.",
						),
					)
					.addComponent(button)
					.toJSON(),
			],
			flags: [InteractionReplyFlags.IsComponentsV2],
		});
	},
};

export default authorizeAccountCommand;
