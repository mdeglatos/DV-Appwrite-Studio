
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { AppwriteProject, AppwriteFunction } from '../../../types';
import { McpIcon, RiRocketLine, LoadingSpinnerIcon, SettingsIcon, RefreshIcon, RiGlobalLine, CheckIcon, CopyIcon, WarningIcon, ExternalLinkIcon, CodeIcon, DownloadCloudIcon, FileIcon } from '../../Icons';
import { toolDefinitionGroups } from '../../../tools';
import { deployCodeFromString } from '../../../tools/functionsTools';
import { getSdkFunctions, consoleLinks } from '../../../services/appwrite';
import { ToolConfiguration } from '../ui/ToolConfiguration';

interface McpTabProps {
    activeProject: AppwriteProject;
}

type McpSubTab = 'gateway' | 'client';

export const McpTab: React.FC<McpTabProps> = ({ activeProject }) => {
    const [activeSubTab, setActiveSubTab] = useState<McpSubTab>('gateway');
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployedFunction, setDeployedFunction] = useState<AppwriteFunction | null>(null);
    const [isCheckingStatus, setIsCheckingStatus] = useState(true);
    const [copiedConfig, setCopiedConfig] = useState(false);
    const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
    
    // Client Config State
    const [localBridgePath, setLocalBridgePath] = useState('');
    
    const [serverName, setServerName] = useState(() => 
        `appwrite-${activeProject.name.toLowerCase().replace(/\s+/g, '-')}`
    );
    const [publicDomain, setPublicDomain] = useState('');
    const [domainError, setDomainError] = useState(false);

    const [mcpTools, setMcpTools] = useState<{ [key: string]: boolean }>(() => {
        const initialState: { [key: string]: boolean } = {};
        Object.values(toolDefinitionGroups).flat().forEach(t => initialState[t.name] = true);
        return initialState;
    });

    const checkDeploymentStatus = useCallback(async () => {
        setIsCheckingStatus(true);
        setDomainError(false);
        try {
            const sdk = getSdkFunctions(activeProject);
            const func = await sdk.get("mcp-gateway");
            setDeployedFunction(func as unknown as AppwriteFunction);
            
            // Try to fetch domains
            try {
                // @ts-ignore - Check if listDomains exists before calling to prevent runtime errors on older SDKs
                if (typeof sdk.listDomains === 'function') {
                    // @ts-ignore
                    const domainsList = await sdk.listDomains(func.$id);
                    if (domainsList.domains.length > 0) {
                        setPublicDomain(domainsList.domains[0].domain);
                    } else {
                        setPublicDomain('');
                        setDomainError(true);
                    }
                } else {
                    // Fallback for SDKs where listDomains is missing
                    setPublicDomain('');
                }
            } catch (err) {
                console.warn("Could not list domains:", err);
            }

        } catch (e) {
            setDeployedFunction(null);
        } finally {
            setIsCheckingStatus(false);
        }
    }, [activeProject]);

    useEffect(() => {
        checkDeploymentStatus();
    }, [checkDeploymentStatus]);

    const enabledTools = useMemo(() => {
        const all = Object.values(toolDefinitionGroups).flat();
        return all.filter(t => mcpTools[t.name]);
    }, [mcpTools]);

    const generatedFunctionCode = useMemo(() => {
        // Helper to recursively lowercase 'type' fields for JSON Schema compatibility
        // The @google/genai SDK uses uppercase types (e.g., "OBJECT", "STRING"), but MCP/JSON Schema requires lowercase.
        const sanitizeSchema = (schema: any): any => {
            if (!schema || typeof schema !== 'object') return schema;
            
            const newSchema = Array.isArray(schema) ? [...schema] : { ...schema };

            if (newSchema.type && typeof newSchema.type === 'string') {
                newSchema.type = newSchema.type.toLowerCase();
            }
            
            if (newSchema.properties) {
                const newProps: any = {};
                Object.keys(newSchema.properties).forEach(key => {
                    newProps[key] = sanitizeSchema(newSchema.properties[key]);
                });
                newSchema.properties = newProps;
            }
            
            if (newSchema.items) {
                newSchema.items = sanitizeSchema(newSchema.items);
            }
            
            return newSchema;
        };

        const toolListJson = JSON.stringify(enabledTools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: sanitizeSchema(t.parameters)
        })), null, 2);

        return `
/**
 * Appwrite MCP Gateway v2.6.3 (Custom Headers Support)
 * Implements MCP over HTTP. Waits for async tool execution before returning.
 * Includes schema sanitization for Claude Desktop compatibility.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Client, Databases, Storage, Users, Functions, ID, Query } from "node-appwrite";

// 1. Initialize MCP Server
const server = new Server({
    name: "${serverName}",
    version: "2.6.3",
}, {
    capabilities: { tools: {} }
});

// 2. Define Capabilities
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ${toolListJson}
}));

export default async ({ req, res, log, error }) => {
    // 3. Initialize Appwrite SDK
    const endpoint = process.env.APPWRITE_FUNCTION_ENDPOINT || "${activeProject.endpoint}";
    
    // IMPORTANT: Use custom headers to avoid Appwrite stripping standard auth headers
    // Priority: Custom Header > Env Var > Hardcoded Fallback
    const project = req.headers['x-mcp-project-id'] || process.env.APPWRITE_FUNCTION_PROJECT_ID || "${activeProject.projectId}";
    const key = req.headers['x-mcp-api-key'] || "${activeProject.apiKey}";

    if (!key) {
        error("Missing API Key. Ensure x-mcp-api-key header is set or fallback is configured.");
        return res.json({ 
            jsonrpc: "2.0", 
            error: { code: -32603, message: "Server configuration error: Missing Appwrite API Key." },
            id: null 
        });
    }

    const client = new Client()
        .setEndpoint(endpoint)
        .setProject(project)
        .setKey(key); 

    const dbs = new Databases(client);
    const storage = new Storage(client);
    const users = new Users(client);
    const funcs = new Functions(client);

    // 4. Handle Tool Logic
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const name = request.params.name;
        const args = request.params.arguments || {};
        let result;

        try {
            switch(name) {
                case 'listDatabases': result = await dbs.list([Query.limit(args.limit || 100)]); break;
                case 'listCollections': result = await dbs.listCollections(args.databaseId, [Query.limit(args.limit || 100)]); break;
                case 'listDocuments': result = await dbs.listDocuments(args.databaseId, args.collectionId, [Query.limit(args.limit || 100)]); break;
                case 'getDocument': result = await dbs.getDocument(args.databaseId, args.collectionId, args.documentId); break;
                case 'createDocument': 
                    result = await dbs.createDocument(args.databaseId, args.collectionId, args.documentId === 'unique()' ? ID.unique() : args.documentId, JSON.parse(args.data)); 
                    break;
                case 'updateDocument':
                    result = await dbs.updateDocument(args.databaseId, args.collectionId, args.documentId, JSON.parse(args.data));
                    break;
                case 'deleteDocument':
                    await dbs.deleteDocument(args.databaseId, args.collectionId, args.documentId);
                    result = { success: true, deleted: args.documentId };
                    break;
                case 'listBuckets': result = await storage.listBuckets([Query.limit(args.limit || 100)]); break;
                case 'listFiles': result = await storage.listFiles(args.bucketId, [Query.limit(args.limit || 100)]); break;
                case 'listUsers': result = await users.list([Query.limit(args.limit || 100)]); break;
                default: throw new Error("Tool not implemented in Gateway logic.");
            }
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
            return { content: [{ type: "text", text: "Appwrite Error: " + err.message }], isError: true };
        }
    });

    // 5. Stateless Transport Bridge
    
    // Simple GET check for browser debug
    if (req.method === "GET") {
        return res.send("MCP Gateway Active (v2.6.3). Use POST for JSON-RPC messages.");
    } 
    
    if (req.method === "POST") {
        // Safe parsing of body
        let body;
        try {
            body = req.bodyJson || (typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
        } catch (e) {
            return res.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
        }

        try {
            log("MCP Request: " + body.method);
            
            // We use a mutable variable to capture the response from the 'send' callback
            let responseMessage = null;

            const transport = {
                start: async () => {},
                send: async (message) => {
                    responseMessage = message;
                },
                close: async () => {}
            };

            await server.connect(transport);
            
            // Feed the incoming message to the server
            if (transport.onmessage) {
                await transport.onmessage(body);
            }

            // Wait loop: Poll until we get a response or timeout
            // This is necessary because MCP processes async, and we need to return the result in this HTTP request.
            let retries = 50; // 5 seconds max (50 * 100ms)
            while (!responseMessage && retries > 0) {
                await new Promise(r => setTimeout(r, 100));
                retries--;
            }

            if (responseMessage) {
                return res.json(responseMessage);
            }
            
            // Handle Timeout or Notification
            if (body.id !== undefined) {
                 error("Timeout waiting for MCP response");
                 return res.json({ 
                     jsonrpc: "2.0", 
                     id: body.id, 
                     error: { code: -32000, message: "Gateway Timeout: MCP Server execution took too long." } 
                 });
            } else {
                // It was likely a notification (no ID).
                // DO NOT return a JSON-RPC response object (like result: null) for notifications.
                // Just acknowledge HTTP success.
                return res.json({ ack: true });
            }
            
        } catch (e) {
            error("Message processing failed: " + e.message);
            // Attempt to preserve ID if available
            const msgId = (body && body.id !== undefined) ? body.id : null;
            return res.json({ jsonrpc: "2.0", id: msgId, error: { code: -32603, message: e.message } });
        }
    }

    return res.empty();
};
`.trim();
    }, [enabledTools, activeProject, serverName]);

    const targetUrl = useMemo(() => {
        if (!publicDomain) return "";
        const cleanDomain = publicDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return `https://${cleanDomain}/mcp`;
    }, [publicDomain]);

    // Bridge script for local Node.js execution
    const clientBridgeCode = useMemo(() => {
        if (!targetUrl) return "// Waiting for deployment...";
        return `
/**
 * Appwrite MCP Client Bridge (Stateless Mode)
 * 
 * Run this locally to connect Claude Desktop to your Appwrite Function.
 * Usage: node mcp-bridge.js
 */
const SERVER_URL = "${targetUrl}";

// Headers needed for function execution
// We explicitly pass the project API Key using custom headers to avoid
// them being stripped by the platform or load balancers.
const headers = {
    'x-mcp-project-id': '${activeProject.projectId}',
    'x-mcp-api-key': '${activeProject.apiKey}'
};

async function startBridge() {
    console.error('Bridge starting. Target:', SERVER_URL);

    process.stdin.setEncoding('utf8');
    
    // Buffer for accumulating JSON chunks
    let buffer = '';

    process.stdin.on('data', async (chunk) => {
        buffer += chunk;
        
        // Try to parse complete messages from buffer
        // Note: Simple line-based parsing
        const lines = buffer.split('\\n');
        // Keep the last part if it's incomplete
        buffer = lines.pop();

        for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
                // Verify it's valid JSON before sending
                JSON.parse(line);
                
                // Send to Appwrite
                const response = await fetch(SERVER_URL, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: line
                });

                if (!response.ok) {
                    console.error('Server error:', response.status, response.statusText);
                    // Try to read error text
                    const errText = await response.text();
                    console.error('Details:', errText);
                    continue;
                }

                // Get Response
                const data = await response.json();
                
                // Filter: Only forward valid JSON-RPC 2.0 messages.
                // Ignores HTTP acknowledgements like { ack: true } for notifications.
                if (data && data.jsonrpc === "2.0") {
                    process.stdout.write(JSON.stringify(data) + '\\n');
                }

            } catch (e) {
                console.error('Error processing message:', e.message);
            }
        }
    });
    
    process.stdin.on('end', () => {
        console.error('Bridge input closed.');
        process.exit(0);
    });
}

startBridge();
`;
    }, [targetUrl, activeProject]);

    const mcpConfig = useMemo(() => {
        let cleanPath = localBridgePath.trim().replace(/"/g, ''); 
        // Escape backslashes for JSON
        const jsonPath = cleanPath.replace(/\\/g, '\\\\');

        return {
            "mcpServers": {
                [serverName]: {
                    "command": "node",
                    "args": [
                        jsonPath || "PATH_TO_SCRIPT_HERE"
                    ]
                }
            }
        };
    }, [serverName, localBridgePath]);

    const handleDownloadBridge = () => {
        const blob = new Blob([clientBridgeCode], { type: 'text/javascript' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "mcp-bridge.js";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const handleDeploy = async () => {
        setIsDeploying(true);
        setDeploymentLogs(["Deploying MCP Gateway Function..."]);
        try {
            const sdk = getSdkFunctions(activeProject);
            try { await sdk.get("mcp-gateway"); } 
            catch (e) { await sdk.create("mcp-gateway", "MCP Gateway Server", "node-18.0" as any, ["any"], undefined, undefined, 30, true, true); }

            const files = [
                { 
                    name: 'package.json', 
                    content: JSON.stringify({ 
                        name: "mcp-gateway", 
                        type: "module", 
                        dependencies: { 
                            "node-appwrite": "^14.0.0",
                            "@modelcontextprotocol/sdk": "^1.0.0"
                        } 
                    }, null, 2) 
                },
                { name: 'index.js', content: generatedFunctionCode }
            ];

            await deployCodeFromString(activeProject, "mcp-gateway", files, true, "index.js", "npm install");
            setDeploymentLogs(prev => [...prev, "✅ Deployment finished."]);
            await checkDeploymentStatus();
        } catch (err: any) {
            setDeploymentLogs(prev => [...prev, `❌ Error: ${err.message}`]);
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto animate-fade-in space-y-8 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-3">
                        <McpIcon size={32} className="text-cyan-400" />
                        Model Context Protocol
                    </h1>
                    <p className="text-gray-400 font-medium">Remote Gateway for AI Agents (Claude Desktop, etc.)</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={checkDeploymentStatus} title="Refresh Status" className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl transition-all">
                        {isCheckingStatus ? <LoadingSpinnerIcon size={20}/> : <RefreshIcon size={20}/>}
                    </button>
                    <button onClick={handleDeploy} disabled={isDeploying} className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50">
                        {isDeploying ? <LoadingSpinnerIcon size={16}/> : <RiRocketLine size={16}/>}
                        {deployedFunction ? 'Update Gateway' : 'Deploy Gateway'}
                    </button>
                </div>
            </header>

            <div className="flex border-b border-gray-800">
                <button onClick={() => setActiveSubTab('gateway')} className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeSubTab === 'gateway' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>1. Server (Gateway)</button>
                <button onClick={() => setActiveSubTab('client')} className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeSubTab === 'client' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>2. Client (Bridge)</button>
            </div>

            {activeSubTab === 'gateway' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="space-y-6 lg:col-span-1">
                        <div className="bg-gray-800/40 border border-gray-700 rounded-2xl p-5 space-y-4">
                            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><SettingsIcon size={12}/> Settings</h2>
                            
                            <div>
                                <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Server ID</label>
                                <input type="text" value={serverName} onChange={e => setServerName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-100 outline-none font-mono" />
                            </div>

                            <div>
                                <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Function Domain</label>
                                <input 
                                    type="text" 
                                    value={publicDomain} 
                                    onChange={e => setPublicDomain(e.target.value)} 
                                    placeholder={deployedFunction ? "Detecting..." : "Not deployed"}
                                    className={`w-full bg-gray-900 border rounded-lg p-2 text-xs text-gray-100 outline-none font-mono ${domainError ? 'border-red-500/50 focus:border-red-500' : 'border-gray-700 focus:border-cyan-500'}`} 
                                />
                                {deployedFunction && domainError && (
                                    <div className="mt-2 p-2 bg-red-900/20 border border-red-900/30 rounded text-[10px] text-red-300 leading-tight">
                                        <div className="font-bold flex items-center gap-1 mb-1"><WarningIcon size={10}/> Domain Required</div>
                                        Standard functions require a custom domain for cleaner URLs, though this bridge uses direct invocation.
                                    </div>
                                )}
                                {deployedFunction && (
                                    <a 
                                        href={consoleLinks.functionDomains(activeProject, deployedFunction.$id)} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="mt-2 inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:underline"
                                    >
                                        <ExternalLinkIcon size={10} /> Configure Domains
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-800/20 border border-gray-800 rounded-2xl p-3 flex flex-col h-[400px] overflow-y-auto custom-scrollbar">
                            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 mb-3">Expose Capabilities</h2>
                            <ToolConfiguration activeTools={mcpTools} onToolsChange={setMcpTools} showSearch={false} compact={true} />
                        </div>
                    </div>
                    <div className="lg:col-span-3 bg-[#0d1117] border border-gray-800 rounded-2xl overflow-hidden h-[600px] flex flex-col shadow-2xl">
                        <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-[10px] text-gray-500 flex justify-between items-center">
                            <span className="font-mono">mcp-gateway/index.js (Stateless Polling)</span>
                            <span className="text-[9px] bg-cyan-900/40 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800">MCP SDK v1.0.0</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] text-cyan-200/60 custom-scrollbar leading-relaxed">
                            <pre>{generatedFunctionCode}</pre>
                        </div>
                    </div>
                </div>
            )}

            {activeSubTab === 'client' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        {!deployedFunction && (
                            <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center gap-3 text-red-200 text-sm">
                                <WarningIcon />
                                <span>Gateway not deployed yet. Please finish Step 1 first.</span>
                            </div>
                        )}

                        <div className="bg-purple-950/10 border border-purple-900/30 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <RiGlobalLine className="text-purple-400" size={24} />
                                <h3 className="text-lg font-bold text-purple-100">Step A: Get Bridge Script</h3>
                            </div>
                            <p className="text-sm text-gray-400 mb-6">
                                Claude Desktop needs a local translation layer. Download this script and save it somewhere permanent (e.g. your Documents folder).
                            </p>
                            
                            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-xs text-yellow-200">
                                <div className="font-bold flex items-center gap-2 mb-1"><WarningIcon size={12}/> API Key Permissions</div>
                                This bridge script includes your Project API Key to authenticate requests. Ensure your API Key in DV Studio has scopes like <code>databases.read</code>, <code>collections.read</code>, etc.
                            </div>

                            <button 
                                onClick={handleDownloadBridge}
                                disabled={!targetUrl}
                                className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl border border-gray-600 hover:border-gray-500 flex flex-col items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <DownloadCloudIcon size={32} className="text-cyan-400" />
                                <span>Download mcp-bridge.js</span>
                            </button>
                            
                            <div className="mt-6 p-4 bg-black/40 rounded-xl border border-gray-800 text-xs text-gray-400">
                                <p className="font-bold text-gray-300 mb-2">How it works:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Reads JSON-RPC messages from Claude (Stdin).</li>
                                    <li>Forwards them as HTTP POST requests to your Appwrite Function.</li>
                                    <li>Function processes logic and returns JSON immediately.</li>
                                    <li>Bridge prints response to Stdout for Claude.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-gray-800/40 border border-gray-700 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <SettingsIcon className="text-gray-400" size={24} />
                                <h3 className="text-lg font-bold text-gray-100">Step B: Configure Client</h3>
                            </div>
                            
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Path to downloaded script
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <FileIcon size={14} className="text-gray-500" />
                                        </div>
                                        <input 
                                            type="text" 
                                            value={localBridgePath}
                                            onChange={(e) => setLocalBridgePath(e.target.value)}
                                            placeholder="e.g. C:\Users\Arch\Documents\mcp-bridge.js"
                                            className="w-full bg-gray-900 border border-gray-600 text-gray-200 text-xs rounded-lg pl-9 pr-3 py-3 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none font-mono"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1.5">
                                        <span className="bg-gray-800 px-1.5 rounded text-gray-300">Tip</span> 
                                        Right-click the file in Explorer &gt; <strong>Copy as path</strong> to get the exact location.
                                    </p>
                                </div>
                            </div>

                            <div className="relative bg-black/60 rounded-xl border border-gray-800 p-4 shadow-inner">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">claude_desktop_config.json</span>
                                    <button 
                                        disabled={!targetUrl}
                                        onClick={() => { navigator.clipboard.writeText(JSON.stringify(mcpConfig, null, 2)); setCopiedConfig(true); setTimeout(()=>setCopiedConfig(false), 2000); }} 
                                        className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors border border-gray-700"
                                    >
                                        {copiedConfig ? <CheckIcon size={14}/> : <CopyIcon size={14}/>}
                                    </button>
                                </div>
                                <pre className="text-green-200/80 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
                                    {mcpConfig ? JSON.stringify(mcpConfig, null, 2) : "// Waiting for configuration..."}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
