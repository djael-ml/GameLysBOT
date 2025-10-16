const {
	Client,
	GatewayIntentBits,
	EmbedBuilder,
	REST,
	Routes,
	SlashCommandBuilder,
	PermissionFlagsBits,
	PermissionsBitField
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Charge le token uniquement depuis le fichier "clé" (pas d'environnement)
function loadToken() {
	try {
		const filePath = path.join(__dirname, 'clé');
		if (fs.existsSync(filePath)) {
			const fileToken = fs.readFileSync(filePath, 'utf8').trim();
			if (fileToken) return fileToken;
		}
	} catch {}
	return null;
}

const TOKEN = loadToken();
if (!TOKEN) {
	console.error('Discord token manquant. Mettez le token dans le fichier "clé" à la racine du projet.');
	process.exit(1);
}
const GUILD_ID = '1156302392439087187'; // Laisse vide pour commandes globales, ou mets l’ID serveur pour déploiement instantané

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

// ---------- Helpers style & format ----------
const BRAND_COLOR = 0x9B59B6; // violet pro
const SUCCESS_COLOR = 0x2ECC71;
const INFO_COLOR = 0x3498DB;
const WARN_COLOR = 0xF1C40F;
const ERROR_COLOR = 0xE74C3C;

const EMOJI = {
	pulse: '🧠',
	clock: '⏱️',
	server: '🛡️',
	channel: '💬',
	role: '🧩',
	member: '👥',
	boost: '🚀',
	chip: '🖥️',
	storage: '💾',
	graph: '📊',
	link: '🔗'
};

function formatNumber(n) {
	return new Intl.NumberFormat('fr-FR').format(n);
}

function formatBytes(bytes) {
	const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

function formatDuration(ms) {
	const sec = Math.floor(ms / 1000) % 60;
	const min = Math.floor(ms / (1000 * 60)) % 60;
	const hrs = Math.floor(ms / (1000 * 60 * 60)) % 24;
	const days = Math.floor(ms / (1000 * 60 * 60 * 24));
	const parts = [];
	if (days) parts.push(`${days}j`);
	if (hrs) parts.push(`${hrs}h`);
	if (min) parts.push(`${min}m`);
	parts.push(`${sec}s`);
	return parts.join(' ');
}

function baseEmbed(title, color = BRAND_COLOR) {
	return new EmbedBuilder()
		.setColor(color)
		.setTitle(title)
		.setTimestamp()
		.setFooter({ text: 'GameLys • Bot utilitaire' });
}

// Définition des commandes slash
const commands = [
	new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Afficher la latence et les performances du bot'),

	new SlashCommandBuilder()
		.setName('info')
		.setDescription('Informations à propos du bot'),

	new SlashCommandBuilder()
		.setName('serveur')
		.setDescription('Informations sur le serveur'),

	new SlashCommandBuilder()
		.setName('clear')
		.setDescription('Supprimer un nombre de messages')
		.addIntegerOption(o =>
			o.setName('nombre')
				.setDescription('Nombre de messages à supprimer (1-100)')
				.setMinValue(1).setMaxValue(100)
				.setRequired(true)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

	new SlashCommandBuilder()
		.setName('role')
		.setDescription('Ajouter un rôle à un membre')
		.addUserOption(o =>
			o.setName('membre').setDescription('Membre visé').setRequired(true)
		)
		.addStringOption(o =>
			o.setName('nom').setDescription('Nom exact du rôle').setRequired(true)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

	new SlashCommandBuilder()
		.setName('kick')
		.setDescription('Expulser un membre')
		.addUserOption(o =>
			o.setName('membre').setDescription('Membre à expulser').setRequired(true)
		)
		.addStringOption(o =>
			o.setName('raison').setDescription('Raison').setRequired(false)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

	new SlashCommandBuilder()
		.setName('ban')
		.setDescription('Bannir un membre')
		.addUserOption(o =>
			o.setName('membre').setDescription('Membre à bannir').setRequired(true)
		)
		.addStringOption(o =>
			o.setName('raison').setDescription('Raison').setRequired(false)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

	new SlashCommandBuilder()
		.setName('mute')
		.setDescription('Rendre muet un membre (rôle Muted)')
		.addUserOption(o =>
			o.setName('membre').setDescription('Membre à mute').setRequired(true)
		)
		.addIntegerOption(o =>
			o.setName('minutes').setDescription('Durée en minutes (0 = indéfini)').setRequired(false)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

	new SlashCommandBuilder()
		.setName('boosters')
		.setDescription('Nombre de boosters du serveur'),

	new SlashCommandBuilder()
		.setName('stats')
		.setDescription('Statistiques détaillées du serveur'),

	new SlashCommandBuilder()
		.setName('github')
		.setDescription('Ressources GitHub de GameLys'),

	new SlashCommandBuilder()
		.setName('github_info')
		.setDescription('Informations détaillées GitHub GameLys')
].map(c => c.toJSON());

// Enregistrement des commandes (par serveur pour déploiement instantané)
client.once('ready', async () => {
	console.log(`${client.user.tag} est connecté !`);
	client.user.setPresence({ activities: [{ name: 'GameLys 🎮' }], status: 'online' });

	try {
		const rest = new REST({ version: '10' }).setToken(TOKEN);
		if (!GUILD_ID) {
			console.warn('GUILD_ID manquant: enregistrement global (peut prendre jusqu’à 1h).');
			await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
		} else {
			await rest.put(
				Routes.applicationGuildCommands(client.user.id, GUILD_ID),
				{ body: commands }
			);
			console.log('Commandes slash enregistrées pour le serveur.');
		}
	} catch (err) {
		console.error('Erreur enregistrement commandes:', err);
	}
});

// Gestion des interactions
client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const replyEmbed = (title, description, color = BRAND_COLOR) =>
		baseEmbed(title, color).setDescription(description);

	const guild = interaction.guild;

	try {
			switch (interaction.commandName) {
			case 'ping': {
					const wsPing = Math.round(client.ws.ping);
					const start = Date.now();
					await interaction.deferReply({ ephemeral: true });
					const apiLatency = Date.now() - start;

					const mem = process.memoryUsage();
					const cpu = os.loadavg?.()[0] ?? 0; // moyenne 1min
					const uptime = formatDuration(process.uptime() * 1000);
					const nodeV = process.version;
					const djsV = require('discord.js').version;

					const embed = baseEmbed(`${EMOJI.pulse} Statut du bot` , INFO_COLOR)
						.setThumbnail(interaction.client.user.displayAvatarURL())
						.addFields(
							{ name: `${EMOJI.clock} Latences`, value: `WebSocket: **${wsPing}ms**\nAPI Discord: **${apiLatency}ms**`, inline: true },
							{ name: `${EMOJI.storage} Mémoire`, value: `RSS: **${formatBytes(mem.rss)}**\nHeap: **${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)}**`, inline: true },
							{ name: `${EMOJI.chip} Environnement`, value: `Uptime: **${uptime}**\nNode: **${nodeV}**\ndiscord.js: **v${djsV}**`, inline: true }
						);

					return interaction.editReply({ embeds: [embed] });
			}

			case 'info': {
				const embed = new EmbedBuilder()
					.setTitle('GameLys Bot')
					.setDescription('Bot pour serveur gaming')
					.setColor(0xFF00FF)
					.addFields(
						{ name: 'Créateur', value: 'GameLys Team', inline: true },
						{ name: 'Commandes', value: '/ping, /info, /serveur, /clear, /role, /kick, /ban, /mute, /boosters, /stats, /github, /github_info', inline: false }
					)
					.setTimestamp();
				return interaction.reply({ embeds: [embed], ephemeral: true });
			}

				case 'serveur': {
					const owner = await guild.fetchOwner().catch(() => null);
					const channels = guild.channels.cache;
					const textCount = channels.filter(c => c.isTextBased()).size;
					const voiceCount = channels.filter(c => c.type && String(c.type).includes('Voice')).size;
					const catCount = channels.filter(c => c.type && String(c.type).includes('Category')).size;
					const created = `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`;

					const embed = baseEmbed(`${EMOJI.server} ${guild.name}`, SUCCESS_COLOR)
						.setThumbnail(guild.iconURL({ size: 256 }))
						.addFields(
							{ name: `${EMOJI.member} Membres`, value: `Total: **${formatNumber(guild.memberCount)}**`, inline: true },
							{ name: `${EMOJI.role} Rôles`, value: `**${formatNumber(guild.roles.cache.size)}**`, inline: true },
							{ name: `${EMOJI.channel} Salons`, value: `Textuels: **${formatNumber(textCount)}**\nVocaux: **${formatNumber(voiceCount)}**\nCatégories: **${formatNumber(catCount)}**`, inline: true },
							{ name: `${EMOJI.graph} Métadonnées`, value: `Owner: **${owner ? owner.user.tag : 'Inconnu'}**\nCréé: **${created}**`, inline: true },
						);

					return interaction.reply({ embeds: [embed] });
			}

			case 'clear': {
				await interaction.deferReply({ ephemeral: true });
				const nombre = interaction.options.getInteger('nombre', true);
				const channel = interaction.channel;
				const deleted = await channel.bulkDelete(nombre, true);
				const embed = replyEmbed('Nettoyage', `${deleted.size} messages supprimés.`, 0xFFA500);
				return interaction.editReply({ embeds: [embed] });
			}

			case 'role': {
				await interaction.deferReply({ ephemeral: true });
				const target = interaction.options.getUser('membre', true);
				const member = await guild.members.fetch(target.id).catch(() => null);
				const roleName = interaction.options.getString('nom', true);
				if (!member) return interaction.editReply({ embeds: [replyEmbed('Erreur', 'Membre introuvable.', 0xFF5555)] });

				const role = guild.roles.cache.find(r => r.name === roleName);
				if (!role) return interaction.editReply({ embeds: [replyEmbed('Erreur', 'Rôle introuvable.', 0xFF5555)] });

				await member.roles.add(role);
				return interaction.editReply({ embeds: [replyEmbed('Rôle ajouté', `Rôle ${role} ajouté à ${member}.`, 0x55FF55)] });
			}

			case 'kick': {
				await interaction.deferReply({ ephemeral: true });
				const target = interaction.options.getUser('membre', true);
				const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
				const member = await guild.members.fetch(target.id).catch(() => null);
				if (!member) return interaction.editReply({ embeds: [replyEmbed('Erreur', 'Membre introuvable.', 0xFF5555)] });
				if (!member.kickable) return interaction.editReply({ embeds: [replyEmbed('Erreur', 'Je ne peux pas kick ce membre.', 0xFF5555)] });

				await member.kick(reason);
				return interaction.editReply({ embeds: [replyEmbed('Kick', `${member} a été expulsé.\nRaison: ${reason}`, 0xFFA500)] });
			}

			case 'ban': {
				await interaction.deferReply({ ephemeral: true });
				const target = interaction.options.getUser('membre', true);
				const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
				const member = await guild.members.fetch(target.id).catch(() => null);
				if (!member) return interaction.editReply({ embeds: [replyEmbed('Erreur', 'Membre introuvable.', 0xFF5555)] });

				await guild.members.ban(member, { reason });
				return interaction.editReply({ embeds: [replyEmbed('Ban', `${member} a été banni.\nRaison: ${reason}`, 0xFF0000)] });
			}

			case 'mute': {
				await interaction.deferReply({ ephemeral: true });
				const target = interaction.options.getUser('membre', true);
				const minutes = interaction.options.getInteger('minutes') ?? 0;
				const member = await guild.members.fetch(target.id).catch(() => null);
				if (!member) return interaction.editReply({ embeds: [replyEmbed('Erreur', 'Membre introuvable.', 0xFF5555)] });

				let mutedRole = guild.roles.cache.find(r => r.name === 'Muted');
				if (!mutedRole) {
					mutedRole = await guild.roles.create({ name: 'Muted', permissions: [] });
					for (const [, ch] of guild.channels.cache) {
						await ch.permissionOverwrites.edit(mutedRole, { SendMessages: false, Speak: false }).catch(() => null);
					}
				}

				await member.roles.add(mutedRole);
				const base = minutes > 0 ? `pendant ${minutes} minute(s)` : 'indéfiniment';
				await interaction.editReply({ embeds: [replyEmbed('Mute', `${member} a été mute ${base}.`, 0xAAAAAA)] });

				if (minutes > 0) {
					setTimeout(async () => {
						const fresh = await guild.members.fetch(member.id).catch(() => null);
						if (fresh && fresh.roles.cache.has(mutedRole.id)) {
							await fresh.roles.remove(mutedRole).catch(() => null);
							try {
								await interaction.followUp({ embeds: [replyEmbed('Unmute', `${fresh} n’est plus mute.`, 0x55FF55)], ephemeral: true });
							} catch {}
						}
					}, minutes * 60_000);
				}
				return;
			}

			case 'boosters': {
				const count = guild.premiumSubscriptionCount ?? 0;
				const embed = replyEmbed('Boosters', `Nombre de boosters: ${count}`, 0x00FFFF);
				return interaction.reply({ embeds: [embed] });
			}

				case 'stats': {
					const channels = guild.channels.cache;
					const textCount = channels.filter(c => c.isTextBased()).size;
					const voiceCount = channels.filter(c => c.type && String(c.type).includes('Voice')).size;
					const stageCount = channels.filter(c => c.type && String(c.type).includes('Stage')).size;
					const threadCount = channels.filter(c => c.isThread && c.isThread()).size;
					const emojis = guild.emojis?.cache?.size ?? 0;
					const stickers = guild.stickers?.cache?.size ?? 0;
					const boosts = guild.premiumSubscriptionCount ?? 0;
					const roles = guild.roles.cache.size;

					const embed = baseEmbed(`${EMOJI.graph} Statistiques détaillées`, INFO_COLOR)
						.setThumbnail(guild.iconURL({ size: 256 }))
						.addFields(
							{ name: `${EMOJI.member} Membres`, value: `**${formatNumber(guild.memberCount)}**`, inline: true },
							{ name: `${EMOJI.role} Rôles`, value: `**${formatNumber(roles)}**`, inline: true },
							{ name: `${EMOJI.channel} Salons`, value: `Textuels: **${formatNumber(textCount)}**\nVocaux: **${formatNumber(voiceCount)}**\nStages: **${formatNumber(stageCount)}**\nThreads: **${formatNumber(threadCount)}**`, inline: true },
							{ name: `${EMOJI.boost} Nitro`, value: `Boosts: **${formatNumber(boosts)}**`, inline: true },
							{ name: 'Emojis & Stickers', value: `Emojis: **${formatNumber(emojis)}**\nStickers: **${formatNumber(stickers)}**`, inline: true },
							{ name: 'Bot', value: `${client.user.username}`, inline: true }
						);

					return interaction.reply({ embeds: [embed] });
			}

				case 'github': {
					const embed = baseEmbed(`${EMOJI.link} GitHub GameLys`, BRAND_COLOR)
						.setURL('https://github.com/GameLys')
						.setDescription('Accédez aux projets, aux issues et aux ressources.')
						.addFields(
							{ name: 'Organisation', value: '[github.com/GameLys](https://github.com/GameLys)' }
						);
					return interaction.reply({ embeds: [embed] });
			}

				case 'github_info': {
					const embed = baseEmbed('GitHub GameLys', BRAND_COLOR)
						.setURL('https://github.com/GameLys')
						.setDescription('Informations et orientation pour explorer GitHub GameLys.')
						.addFields(
							{ name: 'Statut', value: 'Aucun dépôt public exploitable pour le moment' },
							{ name: 'Conseil', value: 'Surveillez les releases et les projets pour des exemples à venir.' }
						);
					return interaction.reply({ embeds: [embed] });
			}
		}
	} catch (error) {
		console.error(error);
		const embed = replyEmbed('Erreur', 'Une erreur est survenue lors du traitement de la commande.', 0xFF5555);
		if (interaction.deferred || interaction.replied) {
			return interaction.editReply({ embeds: [embed] }).catch(() => null);
		}
		return interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null);
	}
});

// Connexion
client.login(TOKEN).catch(err => {
	const message = (err && err.message) ? err.message : String(err);
	if (message.includes('TokenInvalid')) {
		console.error('Le token Discord est invalide ou révoqué. Vérifiez DISCORD_TOKEN ou le fichier "clé".');
	} else {
		console.error('Échec de connexion du bot:', err);
	}
	process.exit(1);
});
