module.exports = [
    {
        id: "forgotten-backup",
        name: "Forgotten Backup",
        category: "Information Disclosure",
        points: 100,

        objective:
            "Discover an exposed backup directory through web reconnaissance.",

        description:
            "Investigate the Sombra Technologies employee portal and locate an archived IT report.",

        hints: [
            "Web crawlers are often given instructions about pages to avoid.",
            "Look for a standard file that publishes these instructions.",
            "The archived report references a retired service identity.",
        ],

        flag: "SOMBRA{backup_discovered_7f3a91c2}",
    },
];
