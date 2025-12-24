import {
	CommandBuilder,
	CommandContext,
	ContainerBuilder,
	IntegrationType,
	InteractionReplyFlags,
	TextDisplayBuilder,
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
		console.log("Send command called");
		const { options, guild, channel } = interaction;
		const user = interaction.user ?? interaction.member?.user;

		console.log(
			"User:",
			user?.id,
			"Guild:",
			guild?.id,
			"Channel:",
			channel?.id,
		);

		if (!user) {
			console.log("No user found");
			return interaction.reply({
				content: "<:Oops:1453370232277307474> Could not resolve user.",
			});
		}

		const content = options.getString("content")!;
		console.log("Content:", content);

		try {
			const isDM = !guild;
			console.log("Is DM:", isDM);

			if (isDM) {
				console.log("Getting user data for:", `user:${user.id}`);
				const startTime = Date.now();
				const userData = await db.get(`user:${user.id}`);
				console.log("User data retrieved in", Date.now() - startTime, "ms:", userData);

				if (!userData || !userData.activeTicketId) {
					return interaction.reply({
						content:
							"<:Oops:1453370232277307474> You don't have an active ticket. Use </create:1453302198086664249> command in a server first.",
					});
				}

				const ticketStartTime = Date.now();
				const ticketData = await db.get(
					`ticket:${userData.activeTicketId}`,
				);
				console.log("Ticket data retrieved in", Date.now() - ticketStartTime, "ms");

				if (!ticketData || ticketData.status !== "open") {
					return interaction.reply({
						content:
							"<:Oops:1453370232277307474> Your ticket is not active or doesn't exist.",
					});
				}

				const guildStartTime = Date.now();
				const guildData = await db.get(`guild:${ticketData.guildId}`);
				console.log("Guild data retrieved in", Date.now() - guildStartTime, "ms");
				const webhookUrl = guildData?.webhookUrl;

				if (webhookUrl) {
					const webhookUrlWithThread = `${
						webhookUrl as string
					}?thread_id=${ticketData.threadId}`;
					console.log("Sending webhook...");
					const webhookStartTime = Date.now();
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
					console.log("Webhook sent in", Date.now() - webhookStartTime, "ms");
				} else {
					console.log("Sending direct API message...");
					const apiStartTime = Date.now();
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
					console.log("Direct API message sent in", Date.now() - apiStartTime, "ms");
				}

				return interaction.reply({
					content: "# <:thread:1453370245212536832> Message sent",
					components: [
						new ContainerBuilder()
							.addComponent(
								new TextDisplayBuilder().setContent(
									"# <:thread:1453370245212536832> Message sent to ticket.",
								),
							)
							.addComponent(
								new TextDisplayBuilder().setContent(
									`>>> ${content}`,
								),
							)
							.toJSON(),
					],
					flags: [InteractionReplyFlags.IsComponentsV2],
				});
			} else {
				console.log("In guild, checking channel...");
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
