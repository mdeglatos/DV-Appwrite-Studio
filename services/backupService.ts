
import { Client, Databases, Storage, Functions, Users, Teams, ID, Query } from 'node-appwrite';
import type { AppwriteProject, BackupOptions } from '../types';
import { deployCodeFromString } from '../tools/functionsTools';

// Appwrite IDs cannot start with a special character like '_'
export const BACKUP_BUCKET_ID = 'dv-backups';
export const BACKUP_WORKER_ID = 'dv-backup-worker';
export const RESTORE_WORKER_ID = 'dv-restore-worker';

export class BackupService {
    private client: Client;
    private functions: Functions;
    private storage: Storage;
    private project: AppwriteProject;
    private logCallback: (msg: string) => void;

    constructor(project: AppwriteProject, logCallback: (msg: string) => void) {
        this.project = project;
        this.logCallback = logCallback;
        this.client = new Client()
            .setEndpoint(project.endpoint)
            .setProject(project.projectId)
            .setKey(project.apiKey);
        this.functions = new Functions(this.client);
        this.storage = new Storage(this.client);
    }

    private log(msg: string) {
        this.logCallback(`[BackupService] ${msg}`);
    }

    async ensureBackupBucket() {
        try {
            await this.storage.getBucket(BACKUP_BUCKET_ID);
        } catch (e) {
            this.log('Creating system backup bucket...');
            await this.storage.createBucket(
                BACKUP_BUCKET_ID,
                'DV Studio Backups',
                undefined,
                false,
                true,
                undefined,
                ['json', 'gz', 'tar', 'zip'],
                'gzip' as any,
                true,
                true
            );
        }
    }

    async deployBackupWorker() {
        this.log('Deploying high-fidelity backup worker...');
        const packageJson = JSON.stringify({
            name: "backup-worker",
            type: "module",
            dependencies: { "node-appwrite": "^14.0.0" }
        }, null, 2);

        const indexJs = `
import { Client, Databases, Storage, Users, Teams, Functions, Query, ID } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    log('Worker triggered. Analyzing payload...');
    let payload = req.body;
    
    if (typeof payload === 'string' && payload.trim() !== '') {
        try { 
            payload = JSON.parse(payload); 
            log('Successfully parsed string payload');
        } catch(e) { 
            error('Failed to parse string payload: ' + e.message); 
        }
    }
    
    if (payload && payload.data) {
        log('Payload is wrapped in "data" key. Unwrapping...');
        if (typeof payload.data === 'string') {
            try { 
                payload = JSON.parse(payload.data); 
            } catch(e) { 
                error('Failed to parse wrapped data string: ' + e.message); 
            }
        } else {
            payload = payload.data;
        }
    }
    
    const config = payload || {};
    const { endpoint, projectId, apiKey, bucketId, options } = config;
    
    if (!endpoint || !projectId || !apiKey) {
        log('Validation Failed: endpoint=' + (!!endpoint) + ' projectId=' + (!!projectId) + ' apiKey=' + (!!apiKey));
        return res.json({ success: false, error: "Missing configuration in payload" }, 400);
    }

    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const dbs = new Databases(client);
    const storage = new Storage(client);
    const users = new Users(client);
    const teams = new Teams(client);
    const funcs = new Functions(client);

    try {
        log('Starting project backup (High-Fidelity Mode)');
        const backup = {
            timestamp: new Date().toISOString(),
            projectId,
            options,
            databases: [],
            buckets: [],
            functions: [],
            users: [],
            teams: []
        };

        if (options.includeDatabases) {
            log('Scanning Databases & Schemas...');
            const dbList = await dbs.list();
            for (const db of dbList.databases) {
                const dbObj = { ...db, collections: [] };
                const colls = await dbs.listCollections(db.$id);
                for (const collMeta of colls.collections) {
                    const c = await dbs.getCollection(db.$id, collMeta.$id);
                    let docs = [];
                    if (options.includeDocuments) {
                        const docsList = await dbs.listDocuments(db.$id, collMeta.$id, [Query.limit(5000)]);
                        docs = docsList.documents;
                    }
                    dbObj.collections.push({ ...c, documents: docs });
                }
                backup.databases.push(dbObj);
            }
        }

        if (options.includeStorageMetadata) {
            log('Scanning Buckets...');
            const bucketList = await storage.listBuckets();
            backup.buckets = bucketList.buckets;
        }

        if (options.includeFunctions) {
            log('Scanning Functions...');
            const funcList = await funcs.list();
            for (const f of funcList.functions) {
                const variables = await funcs.listVariables(f.$id);
                backup.functions.push({ ...f, variables: variables.variables });
            }
        }

        if (options.includeUsers) {
            log('Scanning Users...');
            const userList = await users.list([Query.limit(5000)]);
            backup.users = userList.users;
        }

        if (options.includeTeams) {
            log('Scanning Teams...');
            const teamList = await teams.list();
            for (const t of teamList.teams) {
                const memberships = await teams.listMemberships(t.$id);
                backup.teams.push({ ...t, memberships: memberships.memberships });
            }
        }

        log('Generating manifest archive...');
        const manifest = JSON.stringify(backup, null, 2);
        const fileName = \`backup_\${projectId}_\${Date.now()}.json\`;
        
        const blob = new Blob([manifest], { type: 'application/json' });
        const formData = new FormData();
        formData.append('fileId', ID.unique());
        formData.append('file', blob, fileName);

        const uploadRes = await fetch(\`\${endpoint}/storage/buckets/\${bucketId}/files\`, {
            method: 'POST',
            headers: { 'X-Appwrite-Project': projectId, 'X-Appwrite-Key': apiKey },
            body: formData
        });

        if (!uploadRes.ok) throw new Error('Failed to upload manifest to storage');
        const result = await uploadRes.json();
        
        return res.json({ success: true, fileId: result.$id, fileName });
    } catch (e) {
        error(e.message);
        return res.json({ success: false, error: e.message }, 500);
    }
};`;

        try { await this.functions.get(BACKUP_WORKER_ID); } 
        catch (e) { await this.functions.create(BACKUP_WORKER_ID, 'DV Backup Worker', 'node-18.0' as any, ['any'], undefined, undefined, 900); }

        await deployCodeFromString(this.project, BACKUP_WORKER_ID, [
            { name: 'package.json', content: packageJson },
            { name: 'src/main.js', content: indexJs }
        ], true, 'src/main.js', 'npm install');
    }

    async deployRestoreWorker() {
        this.log('Deploying high-fidelity restore worker...');
        const packageJson = JSON.stringify({
            name: "restore-worker",
            type: "module",
            dependencies: { "node-appwrite": "^14.0.0" }
        }, null, 2);

        const indexJs = `
import { Client, Databases, Storage, Users, Teams, Functions, Query, ID } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    let payload = req.body;
    
    if (typeof payload === 'string' && payload.trim() !== '') {
        try { payload = JSON.parse(payload); } catch(e) { /* ignore */ }
    }
    
    if (payload && payload.data) {
        if (typeof payload.data === 'string') {
            try { payload = JSON.parse(payload.data); } catch(e) { /* ignore */ }
        } else {
            payload = payload.data;
        }
    }
    
    const config = payload || {};
    const { endpoint, projectId, apiKey, bucketId, fileId } = config;
    
    if (!endpoint || !projectId || !apiKey) {
        return res.json({ success: false, error: "Missing configuration in payload" }, 400);
    }

    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const dbs = new Databases(client);
    const storage = new Storage(client);
    const users = new Users(client);
    const teams = new Teams(client);
    const funcs = new Functions(client);

    try {
        log('Downloading manifest archive...');
        const fileContent = await storage.getFileDownload(bucketId, fileId);
        const backup = JSON.parse(new TextDecoder().decode(fileContent));
        
        log('Starting project reconstruction...');

        for (const db of (backup.databases || [])) {
            try { await dbs.create(db.$id, db.name); } catch(e) {}
            for (const coll of (db.collections || [])) {
                try {
                    await dbs.createCollection(db.$id, coll.$id, coll.name, coll.$permissions, coll.documentSecurity, coll.enabled);
                    for (const attr of (coll.attributes || [])) {
                        try {
                            const a = attr;
                            if (a.type === 'string') await dbs.createStringAttribute(db.$id, coll.$id, a.key, a.size, a.required, a.default, a.array);
                            else if (a.type === 'integer') await dbs.createIntegerAttribute(db.$id, coll.$id, a.key, a.required, a.min, a.max, a.default, a.array);
                        } catch(e) {}
                    }
                    await new Promise(r => setTimeout(r, 2000));
                    for (const doc of (coll.documents || [])) {
                        try {
                            const { $id, $databaseId, $collectionId, $createdAt, $updatedAt, $permissions, ...data } = doc;
                            await dbs.createDocument(db.$id, coll.$id, $id, data, $permissions);
                        } catch(e) {}
                    }
                } catch(e) {}
            }
        }
        
        for (const team of (backup.teams || [])) {
            try { await teams.create(team.$id, team.name); } catch(e) {}
            for (const m of (team.memberships || [])) {
                try { await teams.createMembership(team.$id, m.roles, 'http://localhost', m.userEmail, m.userName); } catch(e) {}
            }
        }

        return res.json({ success: true });
    } catch (e) {
        error(e.message);
        return res.json({ success: false, error: e.message }, 500);
    }
};`;

        try { await this.functions.get(RESTORE_WORKER_ID); } 
        catch (e) { await this.functions.create(RESTORE_WORKER_ID, 'DV Restore Worker', 'node-18.0' as any, ['any'], undefined, undefined, 900); }

        await deployCodeFromString(this.project, RESTORE_WORKER_ID, [
            { name: 'package.json', content: packageJson },
            { name: 'src/main.js', content: indexJs }
        ], true, 'src/main.js', 'npm install');
    }

    async runBackup(options: BackupOptions) {
        await this.ensureBackupBucket();
        
        const payload = JSON.stringify({
            endpoint: this.project.endpoint,
            projectId: this.project.projectId,
            apiKey: this.project.apiKey,
            bucketId: BACKUP_BUCKET_ID,
            options
        });
        
        try {
            const execution = await this.functions.createExecution(BACKUP_WORKER_ID, payload, false);
            
            if (execution.status === 'failed') {
                throw new Error(execution.errors || "Worker runtime crashed");
            }
            
            let result = null;
            try {
                result = JSON.parse(execution.responseBody);
            } catch (e) {
                throw new Error("Failed to parse worker response: " + (execution.responseBody || "Empty response"));
            }
            
            if (result && result.success === false) {
                throw new Error(result.error || "Worker reported a failure");
            }
            
            return result;
        } catch (e: any) {
            if (e instanceof Error) throw e;
            throw new Error(`Execution call failed: ${e.message || String(e)}`);
        }
    }

    async runRestore(fileId: string) {
        const payload = JSON.stringify({
            endpoint: this.project.endpoint,
            projectId: this.project.projectId,
            apiKey: this.project.apiKey,
            bucketId: BACKUP_BUCKET_ID,
            fileId
        });
        
        try {
            const execution = await this.functions.createExecution(RESTORE_WORKER_ID, payload, false);
            
            if (execution.status === 'failed') {
                throw new Error(execution.errors || "Restoration worker crashed");
            }
            
            let result = null;
            try {
                result = JSON.parse(execution.responseBody);
            } catch (e) {
                throw new Error("Failed to parse restore response: " + (execution.responseBody || "Empty response"));
            }
            
            if (result && result.success === false) {
                throw new Error(result.error || "Restoration reported a failure");
            }
            
            return result;
        } catch (e: any) {
            if (e instanceof Error) throw e;
            throw new Error(`Restore execution call failed: ${e.message || String(e)}`);
        }
    }
}
