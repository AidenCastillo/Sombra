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
        active: 0,
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
        active: 1,
    },
    {
        id: "Access Unauthorized Data",
        name: "Access Unauthorized Data",
        category: "Access Control",
        points: 150,

        objective:
            "Access a restricted area of the Sombra Technologies portal without proper authorization.",
        description:
            "The Sombra Technologies employee portal has areas that are restricted to certain users. Find a way to access these areas without proper credentials.",
        hints: [
            "Consider how the portal handles user sessions and authentication.",
            "Look for any endpoints that might be accessible without proper authorization.",
            "You may need to manipulate requests or cookies to gain access.",
            "Has anyone leaked any credentials or tokens that could be used to access restricted areas?",
        ],

        flag: "SOMBRA{unauthorized_access_9b1c2d3e}",
        active: 0,
    },
    {
        id: "Decrypt Sensitive Information",
        name: "Decrypt Sensitive Information",
        category: "Cryptography",
        points: 250,
        objective:
            "Decrypt a piece of sensitive information that has been encrypted using a weak algorithm.",
        description:
            "You have obtained a piece of sensitive information that has been encrypted using a weak algorithm. Your task is to decrypt it and retrieve the original message.",
        hints: [
            "Look for any known vulnerabilities in the encryption algorithm.",
            "Consider using a brute force approach to try different keys.",
            "Check if there are any patterns or structures in the encrypted data that might provide clues.",
        ],
        flag: "SOMBRA{decrypted_sensitive_info_4d5e6f7g}",
        active: 0,
    },
    {
        id: "Utilize Password Hash",
        name: "Utilize Password Hash",
        category: "Password Cracking",
        points: 300,
        objective:
            "You have obtained a password hash. Your task is to figure out how to utilize it to gain access to a system or account.",
        description:
            "You have obtained a password hash from the Sombra Technologies system. Your goal is to use this hash to gain unauthorized access to a user's account or system.",
        hints: [
            "Does the HTTPS endpoint accept the hash directly for authentication?",
            "Consider if the system is vulnerable to any specific attacks that could allow you to use the hash.",
            "You may need to research common techniques for exploiting password hashes.",
        ],
        flag: "SOMBRA{utilized_password_hash_8h9i0j1k}",
        active: 0,
    },
    {
        id: "Wireshark Capture Analysis",
        name: "Wireshark Capture Analysis",
        category: "Network Analysis",
        points: 350,
        objective:
            "Analyze a provided Wireshark capture file to extract sensitive information.",
        description:
            "You have obtained a Wireshark capture file that contains network traffic. Your task is to analyze the traffic and extract any sensitive information that may be present.",
        hints: [
            "Look for any HTTP requests or responses that might contain sensitive data.",
            "Check for any encrypted traffic that might be vulnerable to analysis.",
            "Pay attention to any communication between the client and server that might reveal information about the system or its users.",
        ],
        flag: "SOMBRA{wireshark_analysis_5l6m7n8o}",
        active: 0,
    },
    {
        id: "Cookie Manipulation",
        name: "Cookie Manipulation",
        category: "Web Security",
        points: 100,
        objective:
            "Manipulate cookies to gain unauthorized access to a restricted area of the Sombra Technologies portal.",
        description:
            "The Sombra Technologies employee portal uses cookies for session management. Your task is to manipulate the cookies in order to gain access to a restricted area of the portal without proper authorization.",
        hints: [
            "Inspect the cookies stored in your browser and look for any that might be related to authentication or session management.",
            "Consider how the portal might validate the cookies and what information they might contain.",
            "You may need to modify the cookies in your browser or use a tool to intercept and manipulate the requests.",
        ],
        flag: "SOMBRA{cookie_manipulation_1p2q3r4s}",
        active: 0,
    },
    {
        id: "HTML Inspection",
        name: "HTML Inspection",
        category: "Web Security",
        points: 150,
        objective:
            "Inspect the HTML source code of the Sombra Technologies portal to find hidden information.",
        description:
            "The Sombra Technologies employee portal may contain hidden information in its HTML source code. Your task is to inspect the source code and find any hidden information that could be useful.",
        hints: [
            "Use your browser's developer tools to inspect the HTML source code of the portal.",
            "Look for any comments, hidden elements, or scripts that might contain sensitive information.",
            "Pay attention to any inline JavaScript or CSS that might reveal information about the portal's functionality.",
        ],
        flag: "SOMBRA{html_inspection_2t3u4v5w}",
        active: 0,
    },
    {
        id: "Are my Endpoints Secure?",
        name: "Are my Endpoints Secure?",
        category: "Web Security",
        points: 200,
        objective:
            "There is a API endpoint that is not properly secured. Your task is to find it and exploit it to gain access to sensitive information.",
        description:
            "The Sombra Technologies employee portal has an API endpoint that is not properly secured. How can you find all api endpoints?",
        hints: [
            "Use a tool like Postman or curl to test different endpoints.",
            "Look for any API documentation or comments that might reveal the available endpoints.",
            "Check the application's source code for any hardcoded API endpoint URLs.",
        ],
        flag: "SOMBRA{how_did_you_find_this_endpoint_3x4y5z6a}",
        active: 1,
    },
];
