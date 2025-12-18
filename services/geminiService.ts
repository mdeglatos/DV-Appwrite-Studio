
import { GoogleGenAI, type Chat, type GenerateContentResponse, type Part, type FunctionCall, type Content } from '@google/genai';
import { availableTools, toolDefinitionGroups } from '../tools';
import type { AIContext, Message, ActionMessage, ModelMessage, GroundingChunk } from '../types';
import { logAuditAction } from './auditLogService';

const getClient = (apiKey?: string | null): GoogleGenAI => {
    const keyToUse = apiKey || process.env.API_KEY;
    if (!keyToUse) {
        throw new Error('Gemini API Key is not configured. Please provide one in the sidebar settings or set the API_KEY environment variable.');
    }
    return new GoogleGenAI({ apiKey: keyToUse });
};

const SMART_MODE_INSTRUCTION = `You are an expert Appwrite Developer and System Administrator. You possess a dual capability: you can manage Appwrite resources (Databases, Auth, Storage) via tool calls, AND you are a world-class backend engineer capable of writing production-ready Node.js code for Appwrite Functions.

**YOUR CONTEXT:**
The user is working on the Appwrite project named "{{PROJECT_NAME}}" (ID: {{PROJECT_ID}}).
{{CONTEXT_DETAILS}}

**BEHAVIORAL GUIDELINES:**

1.  **RESOURCE MANAGEMENT (Admin Role):**
    *   When asked to create databases, collections, attributes, or manage users, use the available tools immediately.
    *   Assume the user is referring to the currently active database/collection/bucket if specific IDs are not provided.
    *   Do not ask for confirmation unless the operation is destructive and ambiguous.

2.  **CODE GENERATION (Engineer Role):**
    *   If the user asks to write, fix, or update a Cloud Function, you MUST adopt the persona of a **Senior Backend Engineer**.
    *   **ABSOLUTE COMPLETENESS:** You must generate the **entire, complete code** for files (e.g., 'index.js', 'package.json'). Never provide snippets, placeholders, or "// ... rest of code" comments.
    *   **ROBUSTNESS:** Include full error handling (try/catch), input validation, and proper Appwrite SDK initialization in every piece of code you write.
    *   **DEPLOYMENT:** You have tools to deploy code ('deployNewCodeToFunction'). Use them when the user asks to "deploy" or "save" the code.
    *   **FUNCTION STRUCTURE:**
        *   Export a default async function: \`export default async ({ req, res, log, error }) => { ... }\`
        *   Return JSON: \`return res.json({ ... })\`
        *   Use \`process.env\` for secrets.
        *   Always include \`package.json\` dependencies if using external libraries (including \`node-appwrite\`).

3.  **DEPENDENCY & SEQUENCING (CRITICAL):**
    *   Appwrite has strict resource dependencies. You MUST follow a sequential workflow for complex setups.
    *   **SCHEMA PIPELINE:** 
        1. Turn 1: Create Database and/or Collection.
        2. Turn 2: Create all Attributes.
        3. Turn 3: Create Indexes (ONLY after attributes are confirmed created).
    *   **PROHIBITION:** You are STRICTLY FORBIDDEN from calling \`createIndex\` in the same turn/message as \`createStringAttribute\`, \`createIntegerAttribute\`, etc. You must wait for the attribute tool results first.
    *   **OTHER DEPENDENCIES:**
        *   Create a Bucket before uploading files to it.
        *   Create a Function before creating a Deployment or Variable for it.
    *   **BULLK OPERATIONS:** You can perform multiple attribute creations in a single turn, but dependent indexes must always wait for the next turn.

4.  **SEARCH & KNOWLEDGE:**
    *   Use the 'googleSearch' tool (if enabled) to find the latest Appwrite documentation or solution patterns if you are unsure about a specific API signature.

**CRITICAL CONTEXT AWARENESS:**
When a tool has optional parameters (like databaseId, collectionId, bucketId), and the user's command is general (e.g., "delete this collection"), you MUST use the IDs from the CURRENT active context defined above.
`;

export const createChatSession = (
    activeTools: { [key: string]: boolean }, 
    model: string, 
    context: AIContext,
    geminiThinkingEnabled: boolean,
    apiKey: string | null | undefined,
    initialHistory?: Content[],
): Chat => {
    const ai = getClient(apiKey);

    // Build context details string
    let contextDetails = "";
    if (context.database) contextDetails += `\n- CURRENT Active Database: "${context.database.name}" (ID: ${context.database.$id})`;
    if (context.collection) contextDetails += `\n- CURRENT Active Collection: "${context.collection.name}" (ID: ${context.collection.$id})`;
    if (context.bucket) contextDetails += `\n- CURRENT Active Storage Bucket: "${context.bucket.name}" (ID: ${context.bucket.$id})`;
    if (context.fn) contextDetails += `\n- CURRENT Active Function: "${context.fn.name}" (ID: ${context.fn.$id})`;

    let systemInstruction = SMART_MODE_INSTRUCTION
        .replace('{{PROJECT_NAME}}', context.project.name)
        .replace('{{PROJECT_ID}}', context.project.projectId)
        .replace('{{CONTEXT_DETAILS}}', contextDetails);

    let finalTools: any[] | undefined = undefined;

    // Handle Tools
    if (activeTools['search']) {
        console.log('Google Search is enabled. Using grounding tool.');
        finalTools = [{ googleSearch: {} }];
        
        // Add specific search instruction
        systemInstruction += `\n\n[System Notification: Google Search is ENABLED. Use it to find the latest documentation if you encounter errors.]`;
    }

    // Add selected Appwrite tools
    const allToolDefinitions = Object.values(toolDefinitionGroups).flat();
    const filteredDefinitions = allToolDefinitions.filter(
        toolDef => activeTools[toolDef.name]
    );

    if (filteredDefinitions.length > 0) {
        const functionDeclarations = { functionDeclarations: filteredDefinitions };
        if (finalTools) {
            finalTools.push(functionDeclarations);
        } else {
            finalTools = [functionDeclarations];
        }
    }

    // Define base chat configuration
    const chatConfig: {
        systemInstruction: string;
        tools?: any[];
        thinkingConfig?: { thinkingBudget: number };
    } = {
        systemInstruction: systemInstruction,
        tools: finalTools,
    };

    // Disable thinking if the model is flash and the user has opted out
    if (model === 'gemini-2.5-flash' && !geminiThinkingEnabled) {
        chatConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    return ai.chats.create({
      model: model,
      config: chatConfig,
      history: initialHistory,
    });
};


export const runAI = async (
    chat: Chat,
    prompt: string,
    context: AIContext,
    activeTools: { [key: string]: boolean },
    logCallback: (log: string) => void,
    updateChat: (message: Message) => void,
    files: File[] = [],
    onCodeGenerated?: (files: { name: string; content: string }[]) => void
): Promise<void> => {
    logCallback(`Starting AI run with prompt: "${prompt}"`);
    if (files.length > 0) {
        const fileNames = files.map(f => `${f.name} (${f.type}, ${f.size} bytes)`).join(', ');
        logCallback(`Files attached: ${fileNames}`);
    }
    logCallback(`Targeting Appwrite project: "${context.project.name}" (${context.project.projectId})`);

    // Guard against empty submission
    if (!prompt.trim() && files.length === 0) {
        updateChat({ id: crypto.randomUUID(), role: 'model', content: "Please provide a prompt or a file to continue." });
        return;
    }

    let userMessageText = prompt.trim();
    if (files.length > 0) {
        const fileDescriptions = files.map(file => `**${file.name}** (${file.type})`).join(', ');
        const fileDescription = `The user has attached ${files.length} file(s): ${fileDescriptions}.`;
        
        let systemNote = `\n\n[System note: You have access to these files. To deploy function code, use 'packageAndDeployFunction' with the names of the source files. To upload a pre-made .tar.gz archive, use 'createDeployment'. For other files, use 'writeFile'. You do not need to ask for their content.`;

        if (files.length > 1) {
             const fileNames = files.map(f => `"${f.name}"`).join(', ');
             systemNote += ` When calling a file-based tool, you MUST specify the correct 'fileName' or 'fileNames' argument. Available files: ${fileNames}.`;
        }
        systemNote += `]`;
        
        const systemInstruction = `\n\n${fileDescription}${systemNote}`;
        
        if (userMessageText) {
            userMessageText += systemInstruction;
        } else {
            userMessageText = `${fileDescription} Please determine what to do with them, or call a tool to process them.${systemNote}`;
        }
    }

    // 1. Send the user's prompt to the model
    logCallback(`Sending to AI: ${JSON.stringify({ message: userMessageText }, null, 2)}`);
    let result: GenerateContentResponse = await chat.sendMessage({ message: userMessageText });

    // 2. Loop until the model stops sending function calls
    while (true) {
        const text = result.text;
        const functionCalls = result.functionCalls;
        const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;

        // 2a. If the model returns text, display it. This can happen with or without a tool call.
        if (text) {
            logCallback(`AI intermediate response: ${text}`);
            const modelMessage: ModelMessage = {
                id: crypto.randomUUID(),
                role: 'model',
                content: text,
                groundingChunks: groundingChunks as GroundingChunk[] | undefined,
            };
            updateChat(modelMessage);
        }
        
        // 2b. If there are no more function calls, we are done.
        if (!functionCalls || functionCalls.length === 0) {
            logCallback('No more tool calls. AI run finished.');
            break; // Exit loop
        }

        // 3. We have function calls to execute.
        logCallback(`Model wants to call tools: ${JSON.stringify(functionCalls.map(c => c.name), null, 2)}`);

        // Create an ActionMessage in loading state and add it to the chat
        const actionMessageId = crypto.randomUUID();
        const loadingActionMessage: ActionMessage = {
            id: actionMessageId,
            role: 'action',
            toolCalls: functionCalls,
            isLoading: true,
        };
        updateChat(loadingActionMessage);


        // 4. Execute the tool calls
        const toolCallPromises = functionCalls.map(async (toolCall) => {
            const toolName = toolCall.name as keyof typeof availableTools;
            const startTime = Date.now();

            // STRICT PERMISSION CHECK
            // Even if the model hallucinations a tool call or remembers it from a previous session,
            // we MUST block it if it's currently disabled in the UI.
            if (!activeTools[toolName]) {
                logCallback(`BLOCKED: Model attempted to call disabled tool '${toolName}'.`);
                // Log failed attempt
                logAuditAction({
                    projectId: context.project.projectId,
                    toolName: toolName,
                    args: JSON.stringify(toolCall.args),
                    status: 'error',
                    result: 'Tool blocked by user settings',
                    duration: Date.now() - startTime
                });
                return {
                    functionResponse: {
                        name: toolCall.name,
                        response: { error: `Tool '${toolName}' is disabled in settings. You are not allowed to use it.` },
                    },
                };
            }

            const toolToCall = availableTools[toolName];

            // If the AI is generating code, send it back to the UI to update the editor.
            if (toolName === 'deployNewCodeToFunction' && onCodeGenerated) {
                const codeFiles = (toolCall.args as any).files;
                if (codeFiles && Array.isArray(codeFiles)) {
                    onCodeGenerated(codeFiles);
                }
            }

            if (!toolToCall) {
                logCallback(`Error: Unknown tool referenced by the model: ${toolCall.name}`);
                logAuditAction({
                    projectId: context.project.projectId,
                    toolName: toolCall.name,
                    args: JSON.stringify(toolCall.args),
                    status: 'error',
                    result: 'Unknown tool',
                    duration: Date.now() - startTime
                });
                return {
                    functionResponse: {
                        name: toolCall.name,
                        response: { error: `Tool ${toolCall.name} not found.` },
                    },
                };
            }
            
            // Clone args and inject file(s) if needed for specific tools
            const finalArgs = { ...toolCall.args };
            if (toolName === 'writeFile' || toolName === 'createDeployment') {
                let fileToUpload: File | undefined = undefined;
                const targetFileName = (finalArgs as any).fileName;

                if (targetFileName) {
                    fileToUpload = files.find(f => f.name === targetFileName);
                } else if (files.length === 1) {
                    fileToUpload = files[0];
                }
                
                if (toolName === 'writeFile') {
                    (finalArgs as any).fileToUpload = fileToUpload;
                } else if (toolName === 'createDeployment') {
                    (finalArgs as any).codeFile = fileToUpload;
                }
            }


            // Execute the tool
            logCallback(`Executing tool: ${toolName} with args: ${JSON.stringify(toolCall.args, null, 2)}`);
            try {
                const toolResult = await (toolToCall as any)(context, finalArgs);
                const duration = Date.now() - startTime;
                logCallback(`Tool execution result for ${toolName}: ${JSON.stringify(toolResult, null, 2)}`);
                
                // Audit Log Success
                logAuditAction({
                    projectId: context.project.projectId,
                    toolName: toolName,
                    args: JSON.stringify(toolCall.args),
                    status: toolResult && toolResult.error ? 'error' : 'success',
                    result: JSON.stringify(toolResult),
                    duration: duration
                });

                return {
                    functionResponse: {
                        name: toolCall.name,
                        response: toolResult,
                    },
                };
            } catch (err: any) {
                const duration = Date.now() - startTime;
                const errorMessage = err.message || String(err);
                
                // Audit Log Failure
                logAuditAction({
                    projectId: context.project.projectId,
                    toolName: toolName,
                    args: JSON.stringify(toolCall.args),
                    status: 'error',
                    result: errorMessage,
                    duration: duration
                });

                return {
                    functionResponse: {
                        name: toolCall.name,
                        response: { error: errorMessage },
                    },
                };
            }
        });

        const toolResponses: Part[] = await Promise.all(toolCallPromises);

        // 5. Update the ActionMessage with the results
        const completedActionMessage: ActionMessage = {
            ...loadingActionMessage,
            isLoading: false,
            toolResults: toolResponses,
        };
        updateChat(completedActionMessage);


        // 6. Send all tool results back to the model and continue the loop
        logCallback(`Sending tool results to AI: ${JSON.stringify(toolResponses, null, 2)}`);
        
        // Add a text part to provide context to the model about the tool results.
        // This is intended to help the Gemini API correctly process the function responses and avoid potential errors.
        const messageWithContext: Part[] = [
            { text: "The requested tool calls have been executed. Here are their results. Please analyze these and formulate the next response." },
            ...toolResponses
        ];

        result = await chat.sendMessage({ message: messageWithContext });
    }
};
