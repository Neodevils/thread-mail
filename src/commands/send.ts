import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	CommandBuilder,
	CommandContext,
	ContainerBuilder,
	SectionBuilder,
	TextDisplayBuilder,
	IntegrationType,
	type MiniComponentMessageActionRow,
	type CommandInteraction,
	type MiniInteractionCommand,
} from "@minesa-org/mini-interaction";

/**
 * /send command - Posts the canonical render of a ticket inside a thread.
 */
const sendCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("send")
		.setDescription("Post a ticket canonical render inside this thread")
		.setContexts([CommandContext.Guild])
		.setIntegrationTypes([IntegrationType.GuildInstall])
		.addStringOption((option) =>
			option
				.setName("content")
				.setDescription("The content of the ticket")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("role")
				.setDescription("Your role (user/staff)")
				.setRequired(true)
				.addChoices(
					{ name: "User", value: "user" },
					{ name: "Staff", value: "staff" },
				),
		)
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		const { options } = interaction;
		const user = interaction.user ?? interaction.member?.user;

		if (!user) {
			return interaction.reply({ content: "Could not resolve user." });
		}

		const content = options.getString("content")!;
		const role = options.getString("role")!;

		// NOTE: In the next step, we will implement the storage layer
		// to persist this state. For now, we render the canonical message.

		const container = new ContainerBuilder()
			.addComponent(
				new SectionBuilder()
					.addComponent(
						new TextDisplayBuilder().setContent(
							`**Ticket: OPEN**\n${content}`,
						),
					)
					.addComponent(
						new TextDisplayBuilder().setContent(
							`**Author:** <@${
								user.id
							}>\n**Role:** ${role.toUpperCase()}\n**Status:** OPEN`,
						),
					),
			)
			.setAccentColor(0x00ff00);

		const refreshButton = new ButtonBuilder()
			.setCustomId("ticket:refresh")
			.setLabel("Refresh")
			.setStyle(ButtonStyle.Secondary);

		const closeButton = new ButtonBuilder()
			.setCustomId("ticket:close")
			.setLabel("Close Ticket")
			.setStyle(ButtonStyle.Danger);

		const row = new ActionRowBuilder<MiniComponentMessageActionRow>()
			.addComponents(refreshButton, closeButton)
			.toJSON();

		return interaction.reply({
			container: container.toJSON(),
			components: [row],
		} as any);
	},
};

export default sendCommand;
