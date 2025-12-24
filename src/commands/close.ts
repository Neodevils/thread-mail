import {
	CommandBuilder,
	CommandContext,
	IntegrationType,
	type CommandInteraction,
	type MiniInteractionCommand,
} from "@minesa-org/mini-interaction";

const closeCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("close")
		.setDescription("Close and archive the current ticket thread")
		.setContexts([CommandContext.Guild])
		.setIntegrationTypes([IntegrationType.GuildInstall])
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		const user = interaction.user ?? interaction.member?.user;
		const channel = interaction.channel;

		if (!user) {
			return interaction.reply({ content: "❌ Could not resolve user." });
		}

		// Check if user has ManageThreads permission
		const member = interaction.member;
		const hasManageThreads = member?.permissions?.includes("ManageThreads") || false;

		if (!hasManageThreads) {
			return interaction.reply({
				content: "❌ You need **Manage Threads** permission to close tickets.",
				ephemeral: true,
			});
		}

		// Check if we're in a thread
		if (!channel || channel.type !== 11) { // GuildPublicThread
			return interaction.reply({
				content: "❌ This command can only be used in ticket threads.",
				ephemeral: true,
			});
		}

		try {
			// Archive and lock the thread
			const response = await fetch(`https://discord.com/api/v10/channels/${channel.id}`, {
				method: "PATCH",
				headers: {
					Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					archived: true,
					locked: true,
				}),
			});

			if (!response.ok) {
				throw new Error(`Failed to close thread: ${response.status}`);
			}

			return interaction.reply({
				content: `🔒 **Ticket Closed**\n\nThread has been archived and locked by ${user.username}.`,
				ephemeral: true,
			});

		} catch (error) {
			console.error("Error closing ticket:", error);
			return interaction.reply({
				content: "❌ Failed to close the ticket. Please try again.",
				ephemeral: true,
			});
		}
	},
};

export default closeCommand;
