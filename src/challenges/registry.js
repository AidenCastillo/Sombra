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
    {
        id: "document-upload",
        name: "Document Upload",
        category: "File Upload",
        points: 200,

        objective:
            "Upload a document to the Sombra Technologies portal and retrieve a secret message.",
        description:
            "The Sombra Technologies employee portal allows users to upload documents for processing. Upload a document that will trigger the processing service to reveal a secret message.",
        hints: [
            "The document processing service is vulnerable to a specific type of attack.",
            "Consider how the service might handle different file types.",
            "You may need to craft a file that exploits the service's behavior.",
        ],

        flag: "SOMBRA{document_processor_compromised}",
    },
];
