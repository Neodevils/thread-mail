import {
	CommandBuilder,
	CommandContext,
	IntegrationType,
	InteractionReplyFlags,
	MiniPermFlags,
	type CommandInteraction,
	type MiniInteractionCommand,
} from "@minesa-org/mini-interaction";
import { db } from "../utils/database.ts";

const setPingRoleCommand: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("set-ping-role")
		.setDescription(
			"Set a role to ping when new ticket threads are created",
		)
		.setContexts([CommandContext.Guild])
		.setIntegrationTypes([IntegrationType.GuildInstall])
		.setDefaultMemberPermissions(MiniPermFlags.ManageGuild)
		.addRoleOption((option) =>
			option
				.setName("role")
				.setDescription("The role to ping when new threads are created")
				.setRequired(true),
		)
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		// #region agent log
		fetch(
			"http://127.0.0.1:7242/ingest/26fa2916-1668-4399-a1d1-ea37ef8f3fb3",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					location: "set-ping-role.ts:29",
					message: "Command started",
					data: {},
					timestamp: Date.now(),
					sessionId: "debug-session",
					runId: "run3",
					hypothesisId: "A",
				}),
			},
		).catch(() => {});
		// #endregion

		// First, acknowledge the interaction within 3 seconds
		await interaction.deferReply({
			flags: [InteractionReplyFlags.Ephemeral],
		});

		// #region agent log
		fetch(
			"http://127.0.0.1:7242/ingest/26fa2916-1668-4399-a1d1-ea37ef8f3fb3",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					location: "set-ping-role.ts:33",
					message: "Defer reply done",
					data: {},
					timestamp: Date.now(),
					sessionId: "debug-session",
					runId: "run3",
					hypothesisId: "A",
				}),
			},
		).catch(() => {});
		// #endregion

		const user = interaction.user ?? interaction.member?.user;
		const guild = interaction.guild;
		const roleId = interaction.options.getRole("role")?.id;

		if (!user) {
			return interaction.editReply({
				content: "<:Oops:1453370232277307474> Could not resolve user.",
			});
		}

		if (!guild) {
			return interaction.editReply({
				content:
					"<:Oops:1453370232277307474> This command can only be used in a server.",
			});
		}

		if (!roleId) {
			return interaction.editReply({
				content:
					"<:Oops:1453370232277307474> Please specify a role to ping.",
			});
		}

		try {
			// #region agent log
			fetch(
				"http://127.0.0.1:7242/ingest/26fa2916-1668-4399-a1d1-ea37ef8f3fb3",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						location: "set-ping-role.ts:59",
						message: "Starting database operations",
						data: { guildId: guild.id, roleId: roleId },
						timestamp: Date.now(),
						sessionId: "debug-session",
						runId: "run3",
						hypothesisId: "B",
					}),
				},
			).catch(() => {});
			// #endregion

			// Get existing guild data or create new
			let guildData = await db.get(`guild:${guild.id}`);

			// #region agent log
			fetch(
				"http://127.0.0.1:7242/ingest/26fa2916-1668-4399-a1d1-ea37ef8f3fb3",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						location: "set-ping-role.ts:62",
						message: "Retrieved guild data",
						data: { guildData: JSON.stringify(guildData) },
						timestamp: Date.now(),
						sessionId: "debug-session",
						runId: "run3",
						hypothesisId: "C",
					}),
				},
			).catch(() => {});
			// #endregion

			if (!guildData) {
				guildData = {
					guildId: guild.id,
				};
			}

			// Update with ping role
			guildData.pingRoleId = roleId;

			// Clean up any timestamp fields that might cause conflicts
			// MiniDatabase automatically handles createdAt/updatedAt timestamps
			const cleanGuildData = { ...guildData };
			delete cleanGuildData.createdAt;
			delete cleanGuildData.updatedAt;

			// #region agent log
			fetch(
				"http://127.0.0.1:7242/ingest/26fa2916-1668-4399-a1d1-ea37ef8f3fb3",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						location: "set-ping-role.ts:77",
						message: "About to save guild data",
						data: {
							cleanGuildData: JSON.stringify(cleanGuildData),
						},
						timestamp: Date.now(),
						sessionId: "debug-session",
						runId: "run3",
						hypothesisId: "D",
					}),
				},
			).catch(() => {});
			// #endregion

			await db.set(`guild:${guild.id}`, cleanGuildData);

			// #region agent log
			fetch(
				"http://127.0.0.1:7242/ingest/26fa2916-1668-4399-a1d1-ea37ef8f3fb3",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						location: "set-ping-role.ts:79",
						message: "Database save completed",
						data: {},
						timestamp: Date.now(),
						sessionId: "debug-session",
						runId: "run3",
						hypothesisId: "E",
					}),
				},
			).catch(() => {});
			// #endregion

			return interaction.editReply({
				content: `✅ Successfully set <@&${roleId}> as the role to ping when new ticket threads are created in this server.`,
			});
		} catch (error) {
			console.error("Error setting ping role:", error);
			return interaction.editReply({
				content:
					"<:Oops:1453370232277307474> Failed to set ping role. Please try again.",
			});
		}
	},
};

export default setPingRoleCommand;
