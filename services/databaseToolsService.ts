import { getSdkDatabases, ID } from './appwrite';
import type { AppwriteProject, Database, Collection } from '../types';

/**
 * Generates schema-aware mock data based on Appwrite collection attributes.
 */
export function generateMockField(attribute: any, index: number): any {
    if (attribute.array) {
        // Return an array with 1-3 items
        const length = Math.floor(Math.random() * 3) + 1;
        return Array.from({ length }, (_, i) => generateSingleMockField(attribute, index * 10 + i));
    }
    return generateSingleMockField(attribute, index);
}

function generateSingleMockField(attribute: any, index: number): any {
    const key = attribute.key.toLowerCase();
    
    // Check specific formats or names first
    if (attribute.type === 'string') {
        if (attribute.format === 'email' || key.includes('email')) {
            return `user_${index}_${Math.floor(Math.random() * 1000)}@example.com`;
        }
        if (attribute.format === 'url' || key.includes('url') || key.includes('link') || key.includes('website')) {
            return `https://www.example-${index}.com`;
        }
        if (attribute.format === 'ip' || key.includes('ip') || key.includes('host')) {
            return `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
        }
        if (key.includes('phone') || key.includes('tel') || key.includes('mobile')) {
            return `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;
        }
        if (key.includes('name')) {
            const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth'];
            const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
            const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
            const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
            return `${fn} ${ln}`;
        }
        if (key.includes('title') || key.includes('subject') || key.includes('headline')) {
            const titles = ['New System Deployment', 'Database Maintenance Window', 'Quarterly Revenue Policy', 'API Route Refactor Complete', 'Frontend Layout Redesign Approved'];
            return titles[index % titles.length];
        }
        if (key.includes('desc') || key.includes('content') || key.includes('body') || key.includes('bio')) {
            const paragraphs = [
                'This document represents a system-generated entry for mock testing databases collections.',
                'Ensure to audit all variables, environment keys, and third-party notifications providers credentials prior to production deployment.',
                'The quick brown fox jumps over the lazy dog. System operations are running at normal thresholds, latency checked.'
            ];
            return paragraphs[index % paragraphs.length];
        }
        
        // General text
        const size = attribute.size || 20;
        const text = `MockText_${index}`;
        return text.slice(0, size);
    }
    
    if (attribute.type === 'integer') {
        const min = attribute.min !== undefined && attribute.min !== null ? attribute.min : 0;
        const max = attribute.max !== undefined && attribute.max !== null ? attribute.max : 10000;
        return Math.floor(min + Math.random() * (Math.min(max, min + 10000) - min));
    }
    
    if (attribute.type === 'double') {
        const min = attribute.min !== undefined && attribute.min !== null ? attribute.min : 0.0;
        const max = attribute.max !== undefined && attribute.max !== null ? attribute.max : 1000.0;
        return parseFloat((min + Math.random() * (Math.min(max, min + 1000) - min)).toFixed(2));
    }
    
    if (attribute.type === 'boolean') {
        return Math.random() > 0.5;
    }
    
    if (attribute.type === 'datetime') {
        // Random date within the last 30 days
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 30));
        return date.toISOString();
    }
    
    if (attribute.type === 'enum') {
        if (attribute.elements && attribute.elements.length > 0) {
            return attribute.elements[Math.floor(Math.random() * attribute.elements.length)];
        }
        return 'default';
    }
    
    return null;
}

export async function seedCollection(
    project: AppwriteProject,
    databaseId: string,
    collectionId: string,
    attributes: any[],
    count: number,
    logCallback?: (msg: string) => void
): Promise<number> {
    const sdk = getSdkDatabases(project);
    let successfullyCreated = 0;
    
    if (logCallback) {
        logCallback(`🌱 Starting seeding of ${count} mock documents into collection "${collectionId}"...`);
    }

    // Filter out relationship fields, as they require existing related documents
    const nonRelationalAttributes = attributes.filter(attr => attr.type !== 'relationship' && attr.status === 'available');

    for (let i = 0; i < count; i++) {
        const doc: Record<string, any> = {};
        
        nonRelationalAttributes.forEach(attr => {
            const val = generateMockField(attr, i);
            if (val !== null && val !== undefined) {
                doc[attr.key] = val;
            }
        });

        try {
            await sdk.createDocument(databaseId, collectionId, ID.unique(), doc);
            successfullyCreated++;
            if (logCallback && (successfullyCreated % 10 === 0 || successfullyCreated === count)) {
                logCallback(`✅ Seeded ${successfullyCreated}/${count} documents...`);
            }
        } catch (e: any) {
            if (logCallback) {
                logCallback(`⚠️ Error seeding document ${i + 1}: ${e.message}`);
            }
        }
    }
    
    return successfullyCreated;
}

// 2. ERD Parser and Relationship Visualizer Mapper
export interface ErdNode {
    id: string; // DatabaseID + CollectionID
    collectionId: string;
    name: string;
    databaseId: string;
    attributes: {
        key: string;
        type: string;
        required: boolean;
        array: boolean;
    }[];
}

export interface ErdEdge {
    id: string;
    source: string; // Node ID
    target: string; // Node ID
    sourceKey: string;
    targetKey: string;
    relationType: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
}

export function parseCollectionsToErd(collections: Collection[]): { nodes: ErdNode[], edges: ErdEdge[] } {
    const nodes: ErdNode[] = [];
    const edges: ErdEdge[] = [];
    
    // 1. Map collections to Nodes
    collections.forEach(coll => {
        const attributes: ErdNode['attributes'] = [];
        const attrsList = (coll.attributes as any[]) || [];
        
        attrsList.forEach(attr => {
            // Only add actual field attributes (skip relationships in attribute listing unless they have a local key)
            if (attr.type !== 'relationship') {
                attributes.push({
                    key: attr.key,
                    type: attr.type,
                    required: !!attr.required,
                    array: !!attr.array
                });
            }
        });
        
        nodes.push({
            id: `${coll.databaseId}-${coll.$id}`,
            collectionId: coll.$id,
            name: coll.name,
            databaseId: coll.databaseId,
            attributes
        });
    });

    // 2. Parse relationships to Edges
    collections.forEach(coll => {
        const attrsList = (coll.attributes as any[]) || [];
        
        attrsList.forEach(attr => {
            if (attr.type === 'relationship') {
                const sourceId = `${coll.databaseId}-${coll.$id}`;
                const targetId = `${coll.databaseId}-${attr.relatedCollectionId}`;
                const edgeId = `${sourceId}-${attr.key}-${targetId}`;
                
                // Avoid duplicating edges (as Appwrite registers relationship on both sides in some schemas)
                const exists = edges.some(e => 
                    (e.source === sourceId && e.target === targetId && e.sourceKey === attr.key) ||
                    (e.source === targetId && e.target === sourceId && e.targetKey === attr.key)
                );
                
                if (!exists) {
                    edges.push({
                        id: edgeId,
                        source: sourceId,
                        target: targetId,
                        sourceKey: attr.key,
                        targetKey: attr.relatedKey || '',
                        relationType: attr.relationType || 'oneToOne'
                    });
                }
            }
        });
    });

    return { nodes, edges };
}
