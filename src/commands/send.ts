import {
	CommandBuilder,
	CommandContext,
	IntegrationType,
	InteractionReplyFlags,
	type CommandInteraction,
	type MiniInteractionCommand,
} from "@minesa-org/mini-interaction";
import { db } from "../utils/database.ts";

const sendCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("send")
		.setDescription("Send a message to the ticket system")
		.setContexts([CommandContext.Guild, CommandContext.Bot])
		.setIntegrationTypes([
			IntegrationType.GuildInstall,
			IntegrationType.UserInstall,
		])
		.addStringOption((option) =>
			option
				.setName("content")
				.setDescription("The message content")
				.setRequired(true),
		)
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		const { options, guild, channel } = interaction;
		const user = interaction.user ?? interaction.member?.user;

		if (!user) {
			return interaction.reply({
				content: "<:Oops:1453370232277307474> Could not resolve user.",
			});
		}

		const content = options.getString("content")!;

		try {
			const isDM = !guild;

			if (isDM) {
				const userData = await db.get(`user:${user.id}`);

				if (!userData || !userData.activeTicketId) {
					return interaction.reply({
						content:
							"<:Oops:1453370232277307474> You don't have an active ticket. Use </create:1453302198086664249> command in a server first.",
					});
				}

				const ticketData = await db.get(
					`ticket:${userData.activeTicketId}`,
				);

				if (!ticketData || ticketData.status !== "open") {
					return interaction.reply({
						content:
							"<:Oops:1453370232277307474> Your ticket is not active or doesn't exist.",
					});
				}

				const guildData = await db.get(`guild:${ticketData.guildId}`);
				const webhookUrl = guildData?.webhookUrl;

				if (webhookUrl) {
					const webhookUrlWithThread = `${
						webhookUrl as string
					}?thread_id=${ticketData.threadId}`;
					const webhookResponse = await fetch(webhookUrlWithThread, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							content: content,
							username: user.username,
							avatar_url: user.avatar
								? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
								: undefined,
						}),
					});

					if (!webhookResponse.ok) {
						throw new Error(
							`Failed to send webhook message: ${webhookResponse.status}`,
						);
					}
				} else {
					const response = await fetch(
						`https://discord.com/api/v10/channels/${ticketData.threadId}/messages`,
						{
							method: "POST",
							headers: {
								Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								content: `**From ${user.username}:** ${content}`,
							}),
						},
					);

					if (!response.ok) {
						throw new Error(
							`Failed to send message: ${response.status}`,
						);
					}
				}

				return interaction.reply({
					content: `# <:thread:1453370245212536832> Message sent to ticket.\n>>> ${content}`,
				});
			} else {
				if (!channel || channel.type !== 12 || !channel.name) {
					return interaction.reply({
						content:
							"<:Oops:1453370232277307474> This command can only be used in ticket threads.",
						flags: [InteractionReplyFlags.Ephemeral],
					});
				}

				// Find ticket by thread ID
				const threadData = await db.get(`thread:${channel.id}`);
				if (!threadData || !threadData.ticketId) {
					return interaction.reply({
						content:
							"<:Oops:1453370232277307474> This is not a valid ticket thread.",
						flags: [InteractionReplyFlags.Ephemeral],
					});
				}

				const ticketData = await db.get(
					`ticket:${threadData.ticketId}`,
				);
				if (!ticketData || ticketData.status !== "open") {
					return interaction.reply({
						content:
							"<:Oops:1453370232277307474> This ticket is not active or doesn't exist.",
						flags: [InteractionReplyFlags.Ephemeral],
					});
				}

				// Send DM to user
				try {
					// Create DM channel
					const dmResponse = await fetch(
						`https://discord.com/api/v10/users/@me/channels`,
						{
							method: "POST",
							headers: {
								Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								recipient_id: ticketData.userId,
							}),
						},
					);

					if (!dmResponse.ok) {
						throw new Error(
							`Failed to create DM: ${dmResponse.status}`,
						);
					}

					const dmChannel = await dmResponse.json();

					// Send message to DM
					const messageResponse = await fetch(
						`https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
						{
							method: "POST",
							headers: {
								Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								content: `## **Verified Staff <:seal:1453385013931278398> Response:** \n>>> ${content}`,
							}),
						},
					);

					if (!messageResponse.ok) {
						throw new Error(
							`Failed to send message: ${messageResponse.status}`,
						);
					}

					return interaction.reply({
						content: `## <:thread:1453370245212536832> Response sent to user via DM!\n>>> ${content}`,
					});
				} catch (dmError) {
					console.error("DM Error:", dmError);
					return interaction.reply({
						content:
							"<:Oops:1453370232277307474> Could not send DM to user. They may have DMs disabled.",
						flags: [InteractionReplyFlags.Ephemeral],
					});
				}
			}
		} catch (error) {
			console.error("Error in /send command:", error);
			return interaction.reply({
				content:
					"<:Oops:1453370232277307474> An error occurred while sending the message.",
			});
		}
	},
};

export default sendCommand;
