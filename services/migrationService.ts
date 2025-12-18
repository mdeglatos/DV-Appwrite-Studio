import { Client, Databases, Storage, Functions, Users, Teams, ID, Query } from 'node-appwrite';
import type { AppwriteProject } from '../types';
import { deployCodeFromString, downloadAndUnpackDeployment } from '../tools/functionsTools';

export interface MigrationResource {
    type: 'database' | 'collection' | 'bucket' | 'function' | 'team' | 'user';
    sourceId: string;
    targetId: string; // Editable
    sourceName: string;
    targetName: string; // Editable
    enabled: boolean; // Toggleable
    children?: MigrationResource[]; // For Collections inside DBs
    originalData?: any; // To hold specific configs like attributes, permissions, etc.
}

export interface MigrationPlan {
    databases: MigrationResource[];
    buckets: MigrationResource[];
    functions: MigrationResource[];
    teams: MigrationResource[];
    users: MigrationResource[];
    options: MigrationOptions;
}

export interface MigrationOptions {
    migrateDatabases: boolean;
    migrateStorage: boolean;
    migrateFunctions: boolean;
    migrateUsers: boolean;
    migrateTeams: boolean;
    migrateDocuments: boolean; 
    migrateFiles: boolean;
    useCloudProxy: boolean; // New option
}

// Helper to strictly sanitize integers for Appwrite API
function sanitizeInt(val: any): number | undefined {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string' && val.trim() === '') return undefined;
    if (typeof val === 'boolean') return undefined;
    
    // Check for string "null" or "undefined"
    if (typeof val === 'string' && (val.toLowerCase() === 'null' || val.toLowerCase() === 'undefined')) return undefined;

    const num = Number(val);
    
    // Check if it is a valid finite number
    if (!Number.isFinite(num)) return undefined;
    
    // Check for scientific notation that might disguise non-integers. We want to ensure we return an integer.
    return Math.trunc(num);
}

export class MigrationService {
    private sourceClient: Client;
    private destClient: Client;
    private sourceDatabases: Databases;
    private destDatabases: Databases;
    private sourceStorage: Storage;
    private destStorage: Storage;
    private sourceFunctions: Functions;
    private destFunctions: Functions;
    private sourceUsers: Users;
    private destUsers: Users;
    private sourceTeams: Teams;
    private destTeams: Teams;
    private logCallback: (msg: string) => void;
    private stopped = false;
    private migrationKey: string;
    private destProjectConfig: AppwriteProject;
    private sourceProjectConfig: AppwriteProject;

    constructor(source: AppwriteProject, dest: AppwriteProject, logCallback: (msg: string) => void) {
        this.logCallback = logCallback;
        this.migrationKey = `mig_checkpoint_${source.projectId}_${dest.projectId}`;
        this.destProjectConfig = dest;
        this.sourceProjectConfig = source;

        this.sourceClient = new Client()
            .setEndpoint(source.endpoint)
            .setProject(source.projectId)
            .setKey(source.apiKey);

        this.destClient = new Client()
            .setEndpoint(dest.endpoint)
            .setProject(dest.projectId)
            .setKey(dest.apiKey);

        this.sourceDatabases = new Databases(this.sourceClient);
        this.destDatabases = new Databases(this.destClient);
        this.sourceStorage = new Storage(this.sourceClient);
        this.destStorage = new Storage(this.destClient);
        this.sourceFunctions = new Functions(this.sourceClient);
        this.destFunctions = new Functions(this.destClient);
        this.sourceUsers = new Users(this.sourceClient);
        this.destUsers = new Users(this.destClient);
        this.sourceTeams = new Teams(this.sourceClient);
        this.destTeams = new Teams(this.destClient);
    }

    public stop() {
        this.stopped = true;
        this.log('🛑 Force stop requested. Stopping after current operation...');
    }

    private checkStop() {
        if (this.stopped) {
            throw new Error('Migration force stopped by user.');
        }
    }

    private log(msg: string) {
        this.logCallback(msg);
    }

    private error(msg: string, err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.log(`ERROR ${msg}: ${errMsg}`);
    }

    // --- CHECKPOINT METHODS ---
    public hasCheckpoint(): boolean {
        return !!localStorage.getItem(this.migrationKey);
    }

    public clearCheckpoint() {
        localStorage.removeItem(this.migrationKey);
        // Also clear granular cursors
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(`${this.migrationKey}_cursor_`)) {
                localStorage.removeItem(key);
            }
        });
    }

    private saveCursor(resourceKey: string, cursor: string) {
        localStorage.setItem(`${this.migrationKey}_cursor_${resourceKey}`, cursor);
        // Mark overall checkpoint as existing
        if (!localStorage.getItem(this.migrationKey)) {
            localStorage.setItem(this.migrationKey, Date.now().toString());
        }
    }

    private getCursor(resourceKey: string): string | undefined {
        return localStorage.getItem(`${this.migrationKey}_cursor_${resourceKey}`) || undefined;
    }

    // --- PHASE 1: SCAN ---
    async getMigrationPlan(options: MigrationOptions): Promise<MigrationPlan> {
        this.log('Scanning source project to build migration plan...');
        
        const plan: MigrationPlan = {
            databases: [],
            buckets: [],
            functions: [],
            teams: [],
            users: [],
            options
        };

        // Scan Databases & Collections
        if (options.migrateDatabases) {
            const dbs = await this.sourceDatabases.list([Query.limit(100)]);
            for (const db of dbs.databases) {
                const dbRes: MigrationResource = {
                    type: 'database',
                    sourceId: db.$id,
                    targetId: db.$id,
                    sourceName: db.name,
                    targetName: db.name,
                    enabled: true,
                    children: []
                };

                const cols = await this.sourceDatabases.listCollections(db.$id, [Query.limit(100)]);
                for (const col of cols.collections) {
                    dbRes.children?.push({
                        type: 'collection',
                        sourceId: col.$id,
                        targetId: col.$id,
                        sourceName: col.name,
                        targetName: col.name,
                        enabled: true,
                        originalData: col // Keep permissions etc
                    });
                }
                plan.databases.push(dbRes);
            }
        }

        // Scan Storage
        if (options.migrateStorage) {
            const buckets = await this.sourceStorage.listBuckets([Query.limit(100)]);
            for (const bucket of buckets.buckets) {
                plan.buckets.push({
                    type: 'bucket',
                    sourceId: bucket.$id,
                    targetId: bucket.$id,
                    sourceName: bucket.name,
                    targetName: bucket.name,
                    enabled: true,
                    originalData: bucket
                });
            }
        }

        // Scan Functions
        if (options.migrateFunctions) {
            const funcs = await this.sourceFunctions.list([Query.limit(100)]);
            for (const func of funcs.functions) {
                plan.functions.push({
                    type: 'function',
                    sourceId: func.$id,
                    targetId: func.$id,
                    sourceName: func.name,
                    targetName: func.name,
                    enabled: true,
                    originalData: func
                });
            }
        }

        // Scan Teams
        if (options.migrateTeams) {
            const teams = await this.sourceTeams.list([Query.limit(100)]);
            for (const team of teams.teams) {
                plan.teams.push({
                    type: 'team',
                    sourceId: team.$id,
                    targetId: team.$id,
                    sourceName: team.name,
                    targetName: team.name,
                    enabled: true
                });
            }
        }

        // Scan Users
        if (options.migrateUsers) {
             const users = await this.sourceUsers.list([Query.limit(100)]);
             for (const user of users.users) {
                plan.users.push({
                    type: 'user',
                    sourceId: user.$id,
                    targetId: user.$id,
                    sourceName: user.name || user.email,
                    targetName: user.name || user.email,
                    enabled: true,
                    originalData: user
                });
             }
        }

        this.log('Scan complete. Please review the plan.');
        return plan;
    }

    // --- PHASE 2: EXECUTE ---
    async startMigration(plan: MigrationPlan, resume: boolean = false) {
        this.log(resume ? 'Resuming execution phase from last checkpoint...' : 'Starting execution phase...');
        
        if (!resume) {
            this.clearCheckpoint();
        }

        const opts = plan.options;

        // Cloud Proxy Setup
        let cloudWorkerId: string | null = null;
        if (opts.useCloudProxy && opts.migrateStorage && opts.migrateFiles) {
            try {
                cloudWorkerId = await this.deployCloudWorker();
            } catch (e) {
                this.error('deploying cloud worker. Falling back to local transfer.', e);
                opts.useCloudProxy = false;
            }
        }

        try {
            if (opts.migrateDatabases) await this.migrateDatabases(plan.databases, opts.migrateDocuments, resume);
            this.checkStop();
            if (opts.migrateStorage) await this.migrateStorage(plan.buckets, opts.migrateFiles, resume, cloudWorkerId);
            this.checkStop();
            if (opts.migrateFunctions) await this.migrateFunctions(plan.functions);
            this.checkStop();
            if (opts.migrateUsers) await this.migrateUsers(plan.users);
            this.checkStop();
            if (opts.migrateTeams) await this.migrateTeams(plan.teams);
        } finally {
            // Cleanup Worker
            if (cloudWorkerId) {
                this.log('Cleaning up cloud worker...');
                try {
                    await this.destFunctions.delete(cloudWorkerId);
                } catch(e) { console.warn('Failed to delete worker', e); }
            }
        }

        this.log('Migration completed.');
        this.clearCheckpoint();
    }

    // --- CLOUD WORKER HELPERS ---
    private async deployCloudWorker(): Promise<string> {
        this.log('🚀 Deploying Cloud Proxy Worker to Destination Project...');
        const workerName = '_dv_migration_worker';
        const functionId = ID.unique();
        
        // 1. Create Function
        const func = await this.destFunctions.create(
            functionId,
            workerName,
            'node-18.0' as any,
            undefined, // execute
            undefined, // events
            '',        // schedule
            15,        // timeout
            true,      // enabled
            true       // logging
        );

        // 2. Code Bundle
        const packageJson = JSON.stringify({
            name: "migration-worker",
            dependencies: { "node-appwrite": "^14.0.0" }
        });

        const indexJs = `
        const nodeAppwrite = require('node-appwrite');
        const { Client, Storage } = nodeAppwrite;

        module.exports = async ({ req, res, log, error }) => {
            // ... (worker logic)
            try {
                let payload = req.body;
                if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch(e) {} }
                const { sourceEndpoint, sourceProject, sourceKey, destEndpoint, destProject, destKey, bucketId, fileId } = payload;
                const sourceClient = new Client().setEndpoint(sourceEndpoint).setProject(sourceProject).setKey(sourceKey);
                const sourceStorage = new Storage(sourceClient);
                const fileMeta = await sourceStorage.getFile(bucketId, fileId);
                const arrayBuffer = await sourceStorage.getFileDownload(bucketId, fileId);
                const blob = new Blob([arrayBuffer], { type: fileMeta.mimeType });
                const formData = new FormData();
                formData.append('fileId', fileId);
                formData.append('file', blob, fileMeta.name);
                if (fileMeta.$permissions) {
                    fileMeta.$permissions.forEach((p, i) => formData.append(\`permissions[\${i}]\`, p));
                }
                const uploadUrl = \`\${destEndpoint}/storage/buckets/\${bucketId}/files\`;
                const uploadRes = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: { 'X-Appwrite-Project': destProject, 'X-Appwrite-Key': destKey },
                    body: formData
                });
                if (!uploadRes.ok) throw new Error(\`Upload failed: \${uploadRes.status}\`);
                const result = await uploadRes.json();
                return res.json({ success: true, fileId: result.$id });
            } catch (e) {
                return res.json({ success: false, error: e.message }, 500);
            }
        };
        `;

        // 3. Deploy
        await deployCodeFromString(
            this.destProjectConfig,
            func.$id,
            [{ name: 'package.json', content: packageJson }, { name: 'src/main.js', content: indexJs }],
            true, 'src/main.js', 'npm install'
        );

        this.log(`Worker deployed (${func.$id}). Waiting for build...`);
        let tries = 0;
        while(tries < 20) {
            await new Promise(r => setTimeout(r, 2000));
            const deployments = await this.destFunctions.listDeployments(func.$id, [Query.orderDesc('$createdAt'), Query.limit(1)]);
            if (deployments.deployments.length > 0 && deployments.deployments[0].status === 'ready') return func.$id;
            if (deployments.deployments.length > 0 && deployments.deployments[0].status === 'failed') throw new Error('Worker build failed.');
            tries++;
        }
        throw new Error('Worker build timed out.');
    }

    private async executeCloudTransfer(workerId: string, bucketId: string, fileId: string) {
        const payload = JSON.stringify({
            sourceEndpoint: this.sourceProjectConfig.endpoint,
            sourceProject: this.sourceProjectConfig.projectId,
            sourceKey: this.sourceProjectConfig.apiKey,
            destEndpoint: this.destProjectConfig.endpoint,
            destProject: this.destProjectConfig.projectId,
            destKey: this.destProjectConfig.apiKey,
            bucketId,
            fileId
        });
        const execution = await this.destFunctions.createExecution(workerId, payload, false);
        if (execution.status === 'failed') throw new Error(`Worker execution failed: ${execution.responseBody}`);
        const response = JSON.parse(execution.responseBody);
        if (!response.success) throw new Error(response.error);
    }

    // ... (Databases methods same as before) ...
    private async migrateDatabases(dbResources: MigrationResource[], migrateDocuments: boolean, resume: boolean) {
        this.log('Migrating Databases...');
        for (const dbRes of dbResources) {
            this.checkStop();
            if (!dbRes.enabled) continue;
            this.log(`Processing Database: ${dbRes.sourceName} -> ${dbRes.targetName}`);
            try { await this.destDatabases.get(dbRes.targetId); } 
            catch (e) { await this.destDatabases.create(dbRes.targetId, dbRes.targetName); }
            if (dbRes.children) await this.migrateCollections(dbRes.sourceId, dbRes.targetId, dbRes.children, migrateDocuments, resume);
        }
    }

    private async migrateCollections(sourceDbId: string, targetDbId: string, colResources: MigrationResource[], migrateDocuments: boolean, resume: boolean) {
        for (const colRes of colResources) {
            this.checkStop();
            if (!colRes.enabled) continue;
            const col = colRes.originalData;
            try { await this.destDatabases.getCollection(targetDbId, colRes.targetId); } 
            catch (e) { await this.destDatabases.createCollection(targetDbId, colRes.targetId, colRes.targetName, col.$permissions, col.documentSecurity, col.enabled); }
        }
        for (const colRes of colResources) {
            this.checkStop();
            if (!colRes.enabled) continue;
            await this.migrateAttributes(sourceDbId, colRes.sourceId, targetDbId, colRes.targetId, false);
        }
        for (const colRes of colResources) {
            this.checkStop();
            if (!colRes.enabled) continue;
            await this.migrateAttributes(sourceDbId, colRes.sourceId, targetDbId, colRes.targetId, true);
        }
        for (const colRes of colResources) {
            this.checkStop();
            if (!colRes.enabled) continue;
            await this.migrateIndexes(sourceDbId, colRes.sourceId, targetDbId, colRes.targetId);
        }
        if (migrateDocuments) {
             for (const colRes of colResources) {
                 this.checkStop();
                 if (!colRes.enabled) continue;
                 await this.migrateDocuments(sourceDbId, colRes.sourceId, targetDbId, colRes.targetId, resume);
             }
        }
    }

    private async migrateAttributes(sourceDbId: string, sourceColId: string, targetDbId: string, targetColId: string, relationshipsOnly: boolean) {
        const attrs = await this.sourceDatabases.listAttributes(sourceDbId, sourceColId);
        for (const attr of attrs.attributes) {
            this.checkStop();
            const isRel = attr.type === 'relationship';
            if (relationshipsOnly && !isRel) continue;
            if (!relationshipsOnly && isRel) continue;
            try {
                 const destAttrs = await this.destDatabases.listAttributes(targetDbId, targetColId);
                 if (destAttrs.attributes.some((a: any) => a.key === attr.key)) continue;
            } catch (e) { /* ignore */ }
            try {
                const a = attr as any;
                const safeMin = sanitizeInt(a.min);
                const safeMax = sanitizeInt(a.max);
                const safeDefaultInt = sanitizeInt(a.default);
                let effectiveType = a.type;
                if (effectiveType === 'string' && a.format) effectiveType = a.format;

                switch (effectiveType) {
                    case 'string': await this.destDatabases.createStringAttribute(targetDbId, targetColId, a.key, sanitizeInt(a.size) || 255, a.required, a.default, a.array); break;
                    case 'integer': 
                        try { await this.destDatabases.createIntegerAttribute(targetDbId, targetColId, a.key, a.required, safeMin, safeMax, safeDefaultInt, a.array); }
                        catch { await this.destDatabases.createIntegerAttribute(targetDbId, targetColId, a.key, a.required, undefined, undefined, undefined, a.array); }
                        break;
                    case 'float': await this.destDatabases.createFloatAttribute(targetDbId, targetColId, a.key, a.required, a.min, a.max, a.default, a.array); break;
                    case 'boolean': await this.destDatabases.createBooleanAttribute(targetDbId, targetColId, a.key, a.required, a.default, a.array); break;
                    case 'email': await this.destDatabases.createEmailAttribute(targetDbId, targetColId, a.key, a.required, a.default, a.array); break;
                    case 'url': await this.destDatabases.createUrlAttribute(targetDbId, targetColId, a.key, a.required, a.default, a.array); break;
                    case 'ip': await this.destDatabases.createIpAttribute(targetDbId, targetColId, a.key, a.required, a.default, a.array); break;
                    case 'datetime': await this.destDatabases.createDatetimeAttribute(targetDbId, targetColId, a.key, a.required, a.default, a.array); break;
                    case 'enum': await this.destDatabases.createEnumAttribute(targetDbId, targetColId, a.key, a.elements, a.required, a.default, a.array); break;
                    case 'relationship': await this.destDatabases.createRelationshipAttribute(targetDbId, targetColId, a.relatedCollection, a.relationType, a.twoWay, a.key, a.twoWayKey, a.onDelete); break;
                }
                this.log(`    - Created attribute: ${attr.key}`);
                await new Promise(r => setTimeout(r, 200));
            } catch (e) { this.error(`creating attribute ${attr.key}`, e); }
        }
    }

    private async migrateIndexes(sourceDbId: string, sourceColId: string, targetDbId: string, targetColId: string) {
        const sourceIndexes = await this.sourceDatabases.listIndexes(sourceDbId, sourceColId);
        const destIndexes = await this.destDatabases.listIndexes(targetDbId, targetColId);
        for (const idx of sourceIndexes.indexes) {
            this.checkStop();
            if (destIndexes.indexes.some(i => i.key === idx.key)) continue;
            try {
                await this.destDatabases.createIndex(targetDbId, targetColId, idx.key, idx.type as any, idx.attributes, idx.orders);
                this.log(`    - Created index: ${idx.key}`);
            } catch (e) { this.error(`creating index ${idx.key}`, e); }
        }
    }

    private async migrateDocuments(sourceDbId: string, sourceColId: string, targetDbId: string, targetColId: string, resume: boolean) {
        this.log(`    Migrating Documents...`);
        const cursorKey = `doc_${sourceColId}`;
        let cursor = resume ? this.getCursor(cursorKey) : undefined;
        let count = 0;
        while (true) {
            this.checkStop();
            const queries = [Query.limit(100)];
            if (cursor) queries.push(Query.cursorAfter(cursor));
            const docs = await this.sourceDatabases.listDocuments(sourceDbId, sourceColId, queries);
            if (docs.documents.length === 0) break;
            for (const doc of docs.documents) {
                this.checkStop();
                try { await this.destDatabases.getDocument(targetDbId, targetColId, doc.$id); } 
                catch (e) {
                    try {
                        const { $id, $databaseId, $collectionId, $createdAt, $updatedAt, $permissions, ...data } = doc;
                        await this.destDatabases.createDocument(targetDbId, targetColId, $id, data, $permissions);
                        count++;
                    } catch (createErr) { this.error(`creating document ${doc.$id}`, createErr); }
                }
                cursor = doc.$id;
                this.saveCursor(cursorKey, cursor);
            }
            if (docs.documents.length < 100) break;
        }
        if (count > 0) this.log(`    - Migrated ${count} documents.`);
    }

    // ... (Storage methods same as before) ...
    private async migrateStorage(buckets: MigrationResource[], migrateFiles: boolean, resume: boolean, cloudWorkerId: string | null) {
        this.log('Migrating Storage...');
        for (const res of buckets) {
            this.checkStop();
            if(!res.enabled) continue;
            const bucket = res.originalData;
            this.log(`Processing Bucket: ${res.sourceName} -> ${res.targetName}`);
            try { await this.destStorage.getBucket(res.targetId); } 
            catch (e) {
                await this.destStorage.createBucket(res.targetId, res.targetName, bucket.$permissions, bucket.fileSecurity, bucket.enabled, bucket.maximumFileSize, bucket.allowedFileExtensions, bucket.compression, bucket.encryption, bucket.antivirus);
            }
            if (migrateFiles) await this.migrateFiles(res.sourceId, res.targetId, resume, cloudWorkerId);
        }
    }

    private async migrateFiles(sourceBucketId: string, targetBucketId: string, resume: boolean, cloudWorkerId: string | null) {
        const cursorKey = `file_${sourceBucketId}`;
        let cursor = resume ? this.getCursor(cursorKey) : undefined;
        let count = 0;
        while (true) {
            this.checkStop();
            const queries = [Query.limit(50)];
            if (cursor) queries.push(Query.cursorAfter(cursor));
            const files = await this.sourceStorage.listFiles(sourceBucketId, queries);
            if (files.files.length === 0) break;
            for (const file of files.files) {
                this.checkStop();
                try { await this.destStorage.getFile(targetBucketId, file.$id); } 
                catch (e) {
                    try {
                        if (cloudWorkerId) await this.executeCloudTransfer(cloudWorkerId, targetBucketId, file.$id);
                        else {
                            const buffer = await this.sourceStorage.getFileDownload(sourceBucketId, file.$id);
                            const blob = new Blob([buffer]);
                            const fileObj = new File([blob], file.name);
                            const formData = new FormData();
                            formData.append('fileId', file.$id);
                            formData.append('file', fileObj);
                            if (file.$permissions) file.$permissions.forEach((p, i) => formData.append(`permissions[${i}]`, p));
                            const res = await fetch(`${this.destProjectConfig.endpoint.trim().replace(/\/+$/, '')}/storage/buckets/${targetBucketId}/files`, {
                                method: 'POST',
                                headers: { 'X-Appwrite-Project': this.destProjectConfig.projectId, 'X-Appwrite-Key': this.destProjectConfig.apiKey },
                                body: formData,
                            });
                            if (!res.ok) throw new Error('Upload failed');
                        }
                        count++;
                    } catch (err) { this.error(`migrating file ${file.$id}`, err); }
                }
                cursor = file.$id;
                this.saveCursor(cursorKey, cursor);
            }
            if (files.files.length < 50) break;
        }
        if (count > 0) this.log(`  - Migrated ${count} files.`);
    }

    // --- FUNCTIONS (UPDATED) ---
    private async migrateFunctions(funcs: MigrationResource[]) {
        this.log('Migrating Functions...');
        for (const res of funcs) {
            this.checkStop();
            if(!res.enabled) continue;
            
            const func = res.originalData;
            this.log(`Processing Function: ${res.sourceName} -> ${res.targetName}`);
            
            try {
                await this.destFunctions.get(res.targetId);
                this.log(`- Function exists.`);
            } catch (e) {
                await this.destFunctions.create(
                    res.targetId, res.targetName, func.runtime, func.execute, func.events, 
                    func.schedule, func.timeout, func.enabled, func.logging, 
                    func.entrypoint, func.commands, func.scopes, func.installationId, 
                    func.providerRepositoryId, func.providerBranch, func.providerSilentMode, func.providerRootDirectory
                );
                this.log(`- Created function.`);
            }

            await this.migrateVariables(res.sourceId, res.targetId);

            // Deployment Migration Strategy:
            // 1. Download source deployment archive
            // 2. Unpack it (verify content)
            // 3. Repack it using known-good utility
            // 4. Upload to destination
            // This mirroring ensures the code integrity is preserved exactly as seen in the "Code Viewer".

            let deploymentId = func.deployment;
            if (!deploymentId) {
                try {
                    const deps = await this.sourceFunctions.listDeployments(res.sourceId, [Query.limit(1), Query.orderDesc('$createdAt')]);
                    if (deps.deployments.length > 0) {
                        deploymentId = deps.deployments[0].$id;
                        this.log(`  - Found latest deployment: ${deploymentId}`);
                    }
                } catch (err) { /* ignore */ }
            }

            if (deploymentId) {
                try {
                    // Get Metadata to reuse entrypoint/commands if specific to deployment
                    let sourceDeployment;
                    try { sourceDeployment = await this.sourceFunctions.getDeployment(res.sourceId, deploymentId); } catch (e) {}
                    const entrypointToUse = sourceDeployment?.entrypoint || func.entrypoint;
                    const commandsToUse = sourceDeployment?.commands || func.commands;

                    this.log(`- Downloading source code...`);
                    
                    // Use shared utility to download & unpack. This ensures we have valid source files.
                    const files = await downloadAndUnpackDeployment(this.sourceProjectConfig, res.sourceId, deploymentId);

                    if (!files || files.length === 0) {
                        this.log(`  - Warning: Deployment appears empty or could not be unpacked. Skipping code upload.`);
                    } else {
                        this.log(`  - Verified ${files.length} files. Repacking and deploying...`);
                        
                        // Sanitize file paths (remove leading ./)
                        const sanitizedFiles = files.map(f => ({
                            ...f,
                            name: f.name.replace(/^\.\//, '')
                        }));

                        // Force 'npm install' if Node runtime and package.json exists but no command is set.
                        // This fixes issues where source command was implicit but destination requires explicit command.
                        let finalCommands = commandsToUse;
                        const hasPackageJson = sanitizedFiles.some(f => f.name === 'package.json');
                        const isNode = func.runtime && func.runtime.startsWith('node');
                        
                        if (!finalCommands && isNode && hasPackageJson) {
                            finalCommands = 'npm install';
                            this.log(`  - Auto-detect: forcing build command 'npm install'`);
                        }

                        // Use shared utility to repack and upload. This ensures correct FormData handling.
                        const deployment = await deployCodeFromString(
                            this.destProjectConfig,
                            res.targetId,
                            sanitizedFiles,
                            true, // activate
                            entrypointToUse,
                            finalCommands
                        );
                        this.log(`- Migrated deployment (ID: ${deployment.$id}).`);
                    }
                } catch (e) {
                    this.error(`migrating deployment for ${func.name}`, e);
                }
            } else {
                this.log(`- Skipped deployment (none found).`);
            }
        }
    }

    private async migrateVariables(sourceFuncId: string, targetFuncId: string) {
        const vars = await this.sourceFunctions.listVariables(sourceFuncId);
        for (const v of vars.variables) {
            this.checkStop();
            try { await this.destFunctions.getVariable(targetFuncId, v.$id); } 
            catch (e) { await this.destFunctions.createVariable(targetFuncId, v.key, v.value); }
        }
    }

    // ... (Users & Teams methods same as before) ...
    private async migrateUsers(users: MigrationResource[]) {
        this.log('Migrating Users...');
        for (const res of users) {
            this.checkStop();
            if(!res.enabled) continue;
            const user = res.originalData;
             try { await this.destUsers.get(res.targetId); } 
             catch (e) {
                try {
                    if (user.password && user.hash && user.hash === 'argon2') {
                            await this.destUsers.createArgon2User(res.targetId, user.email, user.password, user.name);
                    } else {
                            await this.destUsers.create(res.targetId, user.email, user.phone, undefined, user.name);
                            this.log(`  - Created user ${user.email}`);
                    }
                    if (user.status === false) await this.destUsers.updateStatus(res.targetId, false);
                    if (user.emailVerification) await this.destUsers.updateEmailVerification(res.targetId, true);
                    if (user.phoneVerification) await this.destUsers.updatePhoneVerification(res.targetId, true);
                    if (user.labels && user.labels.length > 0) await this.destUsers.updateLabels(res.targetId, user.labels);
                    if (user.prefs) await this.destUsers.updatePrefs(res.targetId, user.prefs);
                } catch (createErr) { this.error(`creating user ${user.email}`, createErr); }
            }
        }
    }

    private async migrateTeams(teams: MigrationResource[]) {
        this.log('Migrating Teams...');
        for (const res of teams) {
            this.checkStop();
            if(!res.enabled) continue;
            try { await this.destTeams.get(res.targetId); } 
            catch (e) { 
                await this.destTeams.create(res.targetId, res.targetName); 
                this.log(`- Created team: ${res.targetName}`);
            }
            const members = await this.sourceTeams.listMemberships(res.sourceId);
            for (const m of members.memberships) {
                 this.checkStop();
                 try { await this.destTeams.createMembership(res.targetId, m.roles, 'http://localhost', m.userEmail, m.userName); } 
                 catch (memErr) { /* ignore */ }
            }
        }
    }
}
