import {
	InteractionReplyFlags,
	type StringSelectInteraction,
	type MiniInteractionComponent,
} from "@minesa-org/mini-interaction";
import { fetchDiscord } from "../../utils/discord.ts";
import { db } from "../../utils/database.ts";

/**
 * Handler for the server selection menu in the /create command.
 */
export const createMenuHandler: MiniInteractionComponent = {
	customId: "create:select_server",
	handler: async (interaction: StringSelectInteraction) => {
		const guildId = interaction.data.values[0];
		const user = interaction.user ?? interaction.member?.user;

		if (!user) {
			return interaction.reply({
				content: "❌ Could not resolve user.",
			});
		}

		try {
			// TEMP: Skip duplicate check for testing
			/*
			const userData = await db.get(`user:${user.id}`);
			if (userData && userData.activeTicketId) {
				const existingTicket = await db.get(
					`ticket:${userData.activeTicketId}`,
				);
				if (
					existingTicket &&
					existingTicket.status === "open" &&
					existingTicket.guildId === guildId
				) {
					return interaction.reply({
						content: `❌ You already have an open ticket in this server! Please use \`/send\` command in DMs to communicate with staff, or wait for your current ticket to be closed.`,
						flags: [InteractionReplyFlags.Ephemeral],
					});
				}
			}
			*/

			// Generate unique ticket ID (still using timestamp for internal use)
			const ticketId = Date.now().toString();

			// Generate sequential case number
			let caseNumber = 1;
			try {
				const counterData: any = await db.get(`counter:${guildId}`);
				if (counterData && counterData.lastCaseNumber) {
					caseNumber = counterData.lastCaseNumber + 1;
				}
				// Update counter immediately
				await db.set(`counter:${guildId}`, {
					lastCaseNumber: caseNumber,
				});
				console.log(`[CREATE] Guild ${guildId} case number: ${caseNumber}`);
			} catch (error) {
				console.log("Counter error:", error);
				caseNumber = 1; // Fallback
			}

			// 1. Fetch Guild info to get system_channel_id
			const guild = await fetchDiscord(
				`/guilds/${guildId}`,
				process.env.DISCORD_BOT_TOKEN!,
				true,
			);
			const systemChannelId = guild.system_channel_id;

			if (!systemChannelId) {
				return interaction.reply({
					content:
						"❌ This server does not have a system channel configured. Please create a thread manually or configure a system channel.",
				});
			}

			// 2. Create the thread
			const thread = await fetch(
				`https://discord.com/api/v10/channels/${systemChannelId}/threads`,
				{
					method: "POST",
					headers: {
						Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						name: `#${caseNumber} - ${user.username}`,
						auto_archive_duration: 10080, // 1 week
						type: 12, // Guild Private Thread
					}),
				},
			).then((res) => res.json());

			console.log(
				`[CREATE THREAD] Created thread: ${thread.id}, type: ${thread.type}, name: ${thread.name}`,
			);

			// Create webhook for the system channel (if not exists)
			let webhookUrl = null;
			try {
				const webhooks = await fetchDiscord(`/channels/${systemChannelId}/webhooks`, process.env.DISCORD_BOT_TOKEN!, true);
				let existingWebhook = webhooks.find((wh: any) => wh.name === 'TicketSystem');

				if (!existingWebhook) {
					// Create webhook using direct fetch
					const webhookResponse = await fetch(
						`https://discord.com/api/v10/channels/${systemChannelId}/webhooks`,
						{
							method: "POST",
							headers: {
								Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								name: 'TicketSystem',
							}),
						}
					);

					if (webhookResponse.ok) {
						existingWebhook = await webhookResponse.json();
					}
				}

				webhookUrl = `https://discord.com/api/webhooks/${existingWebhook.id}/${existingWebhook.token}`;
				console.log(`[CREATE] Created/found webhook for guild ${guildId}`);
			} catch (webhookError) {
				console.log("Webhook creation error:", webhookError);
				// Continue without webhook - fallback to regular messages
			}

			// 3. Store the thread info and set up initial guild settings
			await db.set(`guild:${guildId}`, {
				guildId,
				guildName: guild.name,
				systemChannelId,
				webhookUrl,
				status: "active",
			});

			// Store ticket information
			await db.set(`ticket:${ticketId}`, {
				ticketId,
				caseNumber,
				guildId,
				userId: user.id,
				username: user.username,
				threadId: thread.id,
				status: "open",
			});

			// Also store by thread ID for quick lookup
			await db.set(`thread:${thread.id}`, {
				ticketId,
			});
			console.log(`[CREATE TICKET] Saved ticket: ticket:${ticketId}`, {
				ticketId,
				caseNumber,
				guildId,
				userId: user.id,
				username: user.username,
				threadId: thread.id,
				status: "open",
			});

			// Store user's active ticket
			await db.set(`user:${user.id}`, {
				activeTicketId: ticketId,
				guildId,
			});
			console.log(`[CREATE TICKET] Saved user data: user:${user.id}`, {
				activeTicketId: ticketId,
				guildId,
			});

			return interaction.reply({
				content: `✅ **Ticket #${ticketId}** created in **${guild.name}**!\n\nThread: <#${thread.id}>\n\nYou can now send messages using \`/send\` command in DMs!`,
				flags: [InteractionReplyFlags.Ephemeral],
			});
		} catch (error) {
			console.error("Error in create menu handler:", error);
			return interaction.reply({
				content:
					"❌ Failed to create thread. Check bot permissions in the selected server.",
			});
		}
	},
};

export default createMenuHandler;
